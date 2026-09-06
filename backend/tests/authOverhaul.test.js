const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');

const authRoutes = require('../routes/authRoutes');
const tradingRoutes = require('../routes/tradingRoutes');
const { UserModel } = require('../models/User');
const { OtpModel } = require('../models/Otp');
const { AccountModel } = require('../models/Account');
const { validateEmail } = require('../utils/emailValidator');
const { createOtp, verifyOtp } = require('../services/otpService');

jest.setTimeout(30000);

let app;
let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    app.use('/api', tradingRoutes);
});

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
    if (mongoServer) {
        await mongoServer.stop();
    }
});

describe('1. Robust Email & Domain Validation Utility', () => {
    test('should accept legitimate public and educational emails', () => {
        expect(validateEmail('student@college.edu').isValid).toBe(true);
        expect(validateEmail('user@gmail.com').isValid).toBe(true);
        expect(validateEmail('trader@yahoo.co.in').isValid).toBe(true);
        expect(validateEmail('pro@company.com').isValid).toBe(true);
    });

    test('should reject disposable, malformed, and test domains', () => {
        expect(validateEmail('fake@mailinator.com').isValid).toBe(false);
        expect(validateEmail('temp@dispostable.com').isValid).toBe(false);
        expect(validateEmail('user@10minutemail.com').isValid).toBe(false);
        expect(validateEmail('test@nonexistentdomain.invalid').isValid).toBe(false);
        expect(validateEmail('bad-syntax-email').isValid).toBe(false);
    });
});

describe('2. OTP Service Logic', () => {
    test('should create, hash, and verify OTP correctly', async () => {
        const testEmail = 'otptest@gmail.com';
        const rawOtp = await createOtp(testEmail, 'EMAIL_VERIFICATION');

        expect(rawOtp).toHaveLength(6);
        expect(/^\d{6}$/.test(rawOtp)).toBe(true);

        const verifyResult = await verifyOtp(testEmail, rawOtp, 'EMAIL_VERIFICATION');
        expect(verifyResult.success).toBe(true);
    });

    test('should reject incorrect or expired OTP', async () => {
        const testEmail = 'wrongotp@gmail.com';
        await createOtp(testEmail, 'EMAIL_VERIFICATION');

        const wrongResult = await verifyOtp(testEmail, '000000', 'EMAIL_VERIFICATION');
        expect(wrongResult.success).toBe(false);
    });
});

describe('3. End-to-End Auth & OTP Workflow API', () => {
    const signupData = {
        name: 'Trader Student',
        email: 'trader.student@college.edu',
        password: 'Password123!'
    };

    let userOtpCode = null;

    test('Step A: Signup should create unverified account and return no OTP in API body', async () => {
        const res = await request(app)
            .post('/api/auth/signup')
            .send(signupData);

        expect(res.status).toBe(201);
        expect(res.body.requiresVerification).toBe(true);
        expect(res.body.otp).toBeUndefined(); // Zero OTP leakage!

        const user = await UserModel.findOne({ email: signupData.email });
        expect(user).toBeDefined();
        expect(user.isVerified).toBe(false);

        // Retrieve OTP directly from DB for test assertion
        const otpRecord = await OtpModel.findOne({ email: signupData.email, type: 'EMAIL_VERIFICATION', used: false });
        expect(otpRecord).toBeDefined();
    });

    test('Step B: Password login should be rejected for unverified user', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: signupData.email, password: signupData.password });

        expect(res.status).toBe(403);
        expect(res.body.requiresVerification).toBe(true);
    });

    test('Step C: Verify OTP should activate account and issue ₹100,000 balance & JWT', async () => {
        // Create fresh OTP for test verification
        const rawOtp = await createOtp(signupData.email, 'EMAIL_VERIFICATION');

        const res = await request(app)
            .post('/api/auth/verify-otp')
            .send({ email: signupData.email, otp: rawOtp });

        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
        expect(res.body.user.isVerified).toBe(true);
        expect(res.body.account.totalBalance).toBe(100000);

        const user = await UserModel.findOne({ email: signupData.email });
        expect(user.isVerified).toBe(true);

        const account = await AccountModel.findOne({ userId: user._id });
        expect(account.totalBalance).toBe(100000);
    });

    test('Step D: Verified user should log in via password successfully', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: signupData.email, password: signupData.password });

        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
        expect(res.body.user.email).toBe(signupData.email);
    });

    test('Step E: Forgot password & reset OTP workflow', async () => {
        // 1. Request Forgot Password
        const forgotRes = await request(app)
            .post('/api/auth/forgot-password')
            .send({ email: signupData.email });

        expect(forgotRes.status).toBe(200);

        // 2. Create reset OTP and verify it
        const resetOtp = await createOtp(signupData.email, 'PASSWORD_RESET');

        const verifyRes = await request(app)
            .post('/api/auth/verify-reset-otp')
            .send({ email: signupData.email, otp: resetOtp });

        expect(verifyRes.status).toBe(200);
        expect(verifyRes.body.resetToken).toBeDefined();

        // 3. Reset Password using resetToken
        const resetRes = await request(app)
            .post('/api/auth/reset-password')
            .send({
                resetToken: verifyRes.body.resetToken,
                newPassword: 'NewSecurePassword456!'
            });

        expect(resetRes.status).toBe(200);

        // 4. Log in with new password
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: signupData.email, password: 'NewSecurePassword456!' });

        expect(loginRes.status).toBe(200);
        expect(loginRes.body.token).toBeDefined();
    });
});
