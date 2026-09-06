const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { UserModel } = require('../models/User');
const { AccountModel } = require('../models/Account');
const { LedgerModel } = require('../models/Ledger');
const { WatchlistModel } = require('../models/Watchlist');
const { ResetTokenModel } = require('../models/ResetToken');
const { generateToken } = require('../middleware/authMiddleware');
const { withTransaction, checkReplicaSet } = require('../config/db');
const { validateEmail } = require('../utils/emailValidator');
const { createOtp, verifyOtp } = require('../services/otpService');
const { sendOtpEmail } = require('../services/emailService');

const DEFAULT_WATCHLIST = ['RELIANCE', 'INFY', 'TCS', 'HDFCBANK', 'ICICIBANK', 'WIPRO', 'TATAPOWER', 'ITC', 'M&M', 'BHARTIARTL'];

/**
 * Step 1: User Signup (Creates unverified account & sends OTP)
 */
async function signup(req, res) {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    // 1. Robust Email & Domain Validation
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
        return res.status(400).json({ message: emailValidation.error });
    }

    const normalizedEmail = emailValidation.normalizedEmail;

    if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    const existingUser = await UserModel.findOne({ email: normalizedEmail });
    if (existingUser) {
        if (existingUser.isVerified) {
            return res.status(409).json({ message: 'User with this email already exists' });
        } else {
            // Unverified user existing: Update password and resend OTP
            const salt = await bcrypt.genSalt(10);
            existingUser.name = name.trim();
            existingUser.passwordHash = await bcrypt.hash(password, salt);
            await existingUser.save();

            try {
                const otpCode = await createOtp(normalizedEmail, 'EMAIL_VERIFICATION');
                await sendOtpEmail(normalizedEmail, otpCode, 'EMAIL_VERIFICATION');
                return res.status(200).json({
                    message: 'Verification OTP sent to your email address.',
                    email: normalizedEmail,
                    requiresVerification: true
                });
            } catch (err) {
                return res.status(429).json({ message: err.message });
            }
        }
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user in unverified state
    const user = await UserModel.create({
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        isVerified: false
    });

    try {
        const otpCode = await createOtp(normalizedEmail, 'EMAIL_VERIFICATION');
        await sendOtpEmail(normalizedEmail, otpCode, 'EMAIL_VERIFICATION');

        return res.status(201).json({
            message: 'Registration successful! Verification OTP sent to your email address.',
            email: normalizedEmail,
            requiresVerification: true
        });
    } catch (err) {
        return res.status(429).json({ message: err.message });
    }
}

/**
 * Step 2: Verify Signup OTP & Activate Account with ₹100,000 Virtual Balance
 */
async function verifySignupOtp(req, res) {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await UserModel.findOne({ email: normalizedEmail });

    if (!user) {
        return res.status(404).json({ message: 'Account not found' });
    }

    if (user.isVerified) {
        return res.status(400).json({ message: 'Account is already verified. Please log in.' });
    }

    const result = await verifyOtp(normalizedEmail, otp, 'EMAIL_VERIFICATION');
    if (!result.success) {
        return res.status(400).json({ message: result.error });
    }

    // Activate User
    user.isVerified = true;
    user.verifiedAt = new Date();
    await user.save();

    let account;
    const createAccountAndWatchlist = async (session) => {
        const options = session ? { session } : {};

        let existingAccount = await AccountModel.findOne({ userId: user._id }, null, options);
        if (!existingAccount) {
            const newAccounts = await AccountModel.create([{
                userId: user._id,
                totalBalance: 100000.00,
                blockedBalance: 0.00
            }], options);
            account = newAccounts[0];

            await LedgerModel.create([{
                userId: user._id,
                type: 'INITIAL_DEPOSIT',
                amount: 100000.00,
                balanceAfter: 100000.00,
                referenceId: account._id.toString()
            }], options);
        } else {
            account = existingAccount;
        }

        let existingWatchlist = await WatchlistModel.findOne({ userId: user._id }, null, options);
        if (!existingWatchlist) {
            await WatchlistModel.create([{
                userId: user._id,
                symbols: DEFAULT_WATCHLIST
            }], options);
        }
    };

    if (checkReplicaSet()) {
        await withTransaction(createAccountAndWatchlist);
    } else {
        await createAccountAndWatchlist(null);
    }

    const token = generateToken(user);

    return res.status(200).json({
        message: 'Email verified successfully! Virtual account activated with ₹100,000.',
        token,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            isVerified: true
        },
        account: account ? {
            totalBalance: account.totalBalance,
            blockedBalance: account.blockedBalance,
            availableBalance: account.availableBalance
        } : null
    });
}

/**
 * Resend OTP Endpoint
 */
async function resendOtp(req, res) {
    const { email, type } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }

    const otpType = type || 'EMAIL_VERIFICATION';
    const normalizedEmail = email.trim().toLowerCase();

    const user = await UserModel.findOne({ email: normalizedEmail });

    if (!user && otpType === 'EMAIL_VERIFICATION') {
        return res.status(404).json({ message: 'User not found' });
    }

    try {
        const otpCode = await createOtp(normalizedEmail, otpType);
        await sendOtpEmail(normalizedEmail, otpCode, otpType);
        return res.status(200).json({ message: 'A new OTP has been sent to your email.' });
    } catch (err) {
        return res.status(429).json({ message: err.message });
    }
}

/**
 * Password Login (Strictly enforcing email verification)
 */
async function login(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await UserModel.findOne({ email: normalizedEmail });
    if (!user) {
        return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
        return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Require Email Verification
    if (!user.isVerified) {
        // Automatically send a fresh verification OTP
        try {
            const otpCode = await createOtp(normalizedEmail, 'EMAIL_VERIFICATION');
            await sendOtpEmail(normalizedEmail, otpCode, 'EMAIL_VERIFICATION');
        } catch (_) {}

        return res.status(403).json({
            message: 'Your email address is not verified. A verification OTP has been sent to your email.',
            requiresVerification: true,
            email: normalizedEmail
        });
    }

    const account = await AccountModel.findOne({ userId: user._id });
    const token = generateToken(user);

    return res.status(200).json({
        message: 'Login successful',
        token,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            isVerified: user.isVerified
        },
        account: account ? {
            totalBalance: account.totalBalance,
            blockedBalance: account.blockedBalance,
            availableBalance: account.availableBalance
        } : null
    });
}

/**
 * Send OTP for Passwordless Login
 */
async function sendLoginOtp(req, res) {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await UserModel.findOne({ email: normalizedEmail });

    if (!user || !user.isVerified) {
        return res.status(400).json({ message: 'No verified account found with this email. Please sign up first.' });
    }

    try {
        const otpCode = await createOtp(normalizedEmail, 'LOGIN_OTP');
        await sendOtpEmail(normalizedEmail, otpCode, 'LOGIN_OTP');
        return res.status(200).json({ message: 'Login OTP sent to your email address.', email: normalizedEmail });
    } catch (err) {
        return res.status(429).json({ message: err.message });
    }
}

/**
 * Verify OTP & Login
 */
async function verifyLoginOtp(req, res) {
    const { email, otp } = req.body;
    if (!email || !otp) {
        return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await UserModel.findOne({ email: normalizedEmail });

    if (!user || !user.isVerified) {
        return res.status(400).json({ message: 'No verified account found with this email.' });
    }

    const result = await verifyOtp(normalizedEmail, otp, 'LOGIN_OTP');
    if (!result.success) {
        return res.status(400).json({ message: result.error });
    }

    const account = await AccountModel.findOne({ userId: user._id });
    const token = generateToken(user);

    return res.status(200).json({
        message: 'OTP Login successful',
        token,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            isVerified: user.isVerified
        },
        account: account ? {
            totalBalance: account.totalBalance,
            blockedBalance: account.blockedBalance,
            availableBalance: account.availableBalance
        } : null
    });
}

/**
 * Forgot Password (Sends OTP without revealing whether account exists)
 */
async function forgotPassword(req, res) {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await UserModel.findOne({ email: normalizedEmail });

    if (user && user.isVerified) {
        try {
            const otpCode = await createOtp(normalizedEmail, 'PASSWORD_RESET');
            await sendOtpEmail(normalizedEmail, otpCode, 'PASSWORD_RESET');
        } catch (err) {
            console.error(`[ForgotPassword] OTP generation error: ${err.message}`);
        }
    }

    // Generic response to prevent account enumeration
    return res.status(200).json({
        message: 'If an account exists with this email address, a password reset OTP has been sent.',
        email: normalizedEmail
    });
}

/**
 * Verify Password Reset OTP & Issue Server-Tracked Reset Token
 */
async function verifyResetOtp(req, res) {
    const { email, otp } = req.body;
    if (!email || !otp) {
        return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const result = await verifyOtp(normalizedEmail, otp, 'PASSWORD_RESET');

    if (!result.success) {
        return res.status(400).json({ message: result.error });
    }

    const user = await UserModel.findOne({ email: normalizedEmail });
    if (!user) {
        return res.status(404).json({ message: 'Account not found' });
    }

    // Invalidate previous active reset tokens for this user/email
    await ResetTokenModel.updateMany(
        { email: normalizedEmail, used: false },
        { $set: { used: true } }
    );

    // Create server-tracked reset authorization token
    const rawResetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawResetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await ResetTokenModel.create({
        userId: user._id,
        email: normalizedEmail,
        tokenHash,
        expiresAt,
        used: false
    });

    return res.status(200).json({
        verified: true,
        resetToken: rawResetToken,
        message: 'OTP verified successfully. Please enter your new password.'
    });
}

/**
 * Reset Password using Server-Tracked Reset Authorization Token
 */
async function resetPassword(req, res) {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) {
        return res.status(400).json({ message: 'Reset token and new password are required' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }

    // Hash incoming reset token to match DB
    const tokenHash = crypto.createHash('sha256').update(resetToken.trim()).digest('hex');
    const now = new Date();

    const tokenRecord = await ResetTokenModel.findOne({
        tokenHash,
        used: false,
        expiresAt: { $gt: now }
    });

    if (!tokenRecord) {
        return res.status(400).json({ message: 'Invalid or expired password reset token. Please request a new OTP.' });
    }

    // Invalidate token (single-use)
    tokenRecord.used = true;
    await tokenRecord.save();

    const user = await UserModel.findById(tokenRecord.userId);
    if (!user) {
        return res.status(404).json({ message: 'Account not found' });
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    await user.save();

    return res.status(200).json({ message: 'Password reset successful! You can now log in with your new password.' });
}

async function getMe(req, res) {
    const user = await UserModel.findById(req.user.id).select('-passwordHash');
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    const account = await AccountModel.findOne({ userId: user._id });

    return res.status(200).json({
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            isVerified: user.isVerified
        },
        account: account ? {
            totalBalance: account.totalBalance,
            blockedBalance: account.blockedBalance,
            availableBalance: account.availableBalance
        } : null
    });
}

module.exports = {
    signup,
    verifySignupOtp,
    resendOtp,
    login,
    sendLoginOtp,
    verifyLoginOtp,
    forgotPassword,
    verifyResetOtp,
    resetPassword,
    getMe
};
