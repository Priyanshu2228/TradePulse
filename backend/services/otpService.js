const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { OtpModel } = require('../models/Otp');

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_RESENDS = 3;

/**
 * Generate 6-digit cryptographic OTP string
 */
function generateOtpCode() {
    // Generate secure random number between 100000 and 999999
    const buf = crypto.randomBytes(4);
    const num = (buf.readUInt32BE(0) % 900000) + 100000;
    return num.toString();
}

/**
 * Create and save a new OTP for an email and purpose
 */
async function createOtp(email, type) {
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Rate Limit Check: Max resends in 15 minutes
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
    const recentOtpsCount = await OtpModel.countDocuments({
        email: normalizedEmail,
        type,
        createdAt: { $gte: windowStart }
    });

    if (recentOtpsCount >= MAX_RESENDS) {
        throw new Error('Too many OTP requests. Please wait 15 minutes before requesting another OTP.');
    }

    // 2. Invalidate previous active OTPs for this email and type
    await OtpModel.updateMany(
        { email: normalizedEmail, type, used: false },
        { $set: { used: true } }
    );

    // 3. Generate raw OTP code and hash
    const rawOtp = generateOtpCode();
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(rawOtp, salt);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    await OtpModel.create({
        email: normalizedEmail,
        otpHash,
        type,
        expiresAt,
        attempts: 0,
        used: false
    });

    return rawOtp;
}

/**
 * Verify an OTP code against active record
 */
async function verifyOtp(email, rawOtp, type) {
    if (!rawOtp || typeof rawOtp !== 'string' || rawOtp.trim().length !== 6) {
        return { success: false, error: 'OTP must be a 6-digit numeric code' };
    }

    const normalizedEmail = email.trim().toLowerCase();
    const now = new Date();

    // Find active non-expired OTP record
    const otpRecord = await OtpModel.findOne({
        email: normalizedEmail,
        type,
        used: false,
        expiresAt: { $gt: now }
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
        return { success: false, error: 'OTP has expired or is invalid. Please request a new OTP.' };
    }

    // Check maximum attempts limit
    if (otpRecord.attempts >= MAX_ATTEMPTS) {
        otpRecord.used = true;
        await otpRecord.save();
        return { success: false, error: 'Maximum OTP verification attempts exceeded. Please request a new OTP.' };
    }

    // Increment attempt counter
    otpRecord.attempts += 1;
    await otpRecord.save();

    // Verify bcrypt hash
    const isMatch = await bcrypt.compare(rawOtp.trim(), otpRecord.otpHash);
    if (!isMatch) {
        const remaining = MAX_ATTEMPTS - otpRecord.attempts;
        return {
            success: false,
            error: remaining > 0
                ? `Invalid OTP code. ${remaining} attempt(s) remaining.`
                : 'Invalid OTP code. Maximum attempts reached.'
        };
    }

    // Mark single-use OTP as used
    otpRecord.used = true;
    await otpRecord.save();

    return { success: true };
}

module.exports = {
    createOtp,
    verifyOtp,
    generateOtpCode
};
