const request = require('supertest');
const mongoose = require('mongoose');

jest.mock('../services/emailService', () => ({
    sendOtpEmail: jest.fn().mockResolvedValue({ success: true, method: 'MOCK' })
}));

const { app } = require('../index');
const { UserModel } = require('../models/User');
const { OtpModel } = require('../models/Otp');
const { ResetTokenModel } = require('../models/ResetToken');
const { connectDB } = require('../config/db');

describe('Password Reset Token Lifecycle & Security Integration Tests', () => {
    let testEmail = 'reset.test@tradepulse.io';
    let testPassword = 'OldPassword123!';
    let newPassword = 'NewPassword456!';
    let user;

    beforeAll(async () => {
        await connectDB();
        await UserModel.deleteMany({ email: testEmail });
        await OtpModel.deleteMany({ email: testEmail });
        await ResetTokenModel.deleteMany({ email: testEmail });

        const bcrypt = require('bcryptjs');
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(testPassword, salt);

        user = await UserModel.create({
            name: 'Reset Test User',
            email: testEmail,
            passwordHash,
            isVerified: true
        });
    });

    afterAll(async () => {
        await UserModel.deleteMany({ email: testEmail });
        await OtpModel.deleteMany({ email: testEmail });
        await ResetTokenModel.deleteMany({ email: testEmail });
        await mongoose.connection.close();
    });

    test('1. Unknown email should receive generic success response without exposing account existence', async () => {
        const res = await request(app)
            .post('/api/auth/forgot-password')
            .send({ email: 'nonexistent.user@tradepulse.io' });

        expect(res.statusCode).toBe(200);
        expect(res.body.message).toContain('If an account exists');
    });

    test('2. Forgot Password request generates PASSWORD_RESET OTP in DB', async () => {
        const res = await request(app)
            .post('/api/auth/forgot-password')
            .send({ email: testEmail });

        expect(res.statusCode).toBe(200);

        const otpDoc = await OtpModel.findOne({ email: testEmail, type: 'PASSWORD_RESET', used: false });
        expect(otpDoc).not.toBeNull();
    });

    test('3. Invalid OTP code is rejected by verify-reset-otp', async () => {
        const res = await request(app)
            .post('/api/auth/verify-reset-otp')
            .send({ email: testEmail, otp: '000000' });

        expect(res.statusCode).toBe(400);
        expect(res.body.message).toMatch(/Invalid OTP/i);
    });

    test('4. Complete Journey: Valid OTP returns server-tracked resetToken', async () => {
        // Fetch raw OTP created by direct helper or service
        const { createOtp } = require('../services/otpService');
        const rawOtp = await createOtp(testEmail, 'PASSWORD_RESET');

        const res = await request(app)
            .post('/api/auth/verify-reset-otp')
            .send({ email: testEmail, otp: rawOtp });

        expect(res.statusCode).toBe(200);
        expect(res.body.verified).toBe(true);
        expect(res.body.resetToken).toBeDefined();
        expect(typeof res.body.resetToken).toBe('string');
        expect(res.body.resetToken.length).toBeGreaterThan(10);

        // Save token for next step
        const resetToken = res.body.resetToken;

        // Verify ResetToken DB entry exists and is active
        const crypto = require('crypto');
        const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
        const tokenDoc = await ResetTokenModel.findOne({ tokenHash, used: false });
        expect(tokenDoc).not.toBeNull();
        expect(tokenDoc.email).toBe(testEmail);

        // 5. Submit new password using resetToken
        const resetRes = await request(app)
            .post('/api/auth/reset-password')
            .send({ resetToken, newPassword });

        expect(resetRes.statusCode).toBe(200);
        expect(resetRes.body.message).toMatch(/Password reset successful/i);

        // 6. Token should now be marked as used in DB
        const updatedTokenDoc = await ResetTokenModel.findOne({ tokenHash });
        expect(updatedTokenDoc.used).toBe(true);

        // 7. Token reuse must be rejected
        const reuseRes = await request(app)
            .post('/api/auth/reset-password')
            .send({ resetToken, newPassword: 'AnotherPassword789!' });

        expect(reuseRes.statusCode).toBe(400);
        expect(reuseRes.body.message).toMatch(/Invalid or expired password reset token/i);

        // 8. User can log in with new password
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: testEmail, password: newPassword });

        expect(loginRes.statusCode).toBe(200);
        expect(loginRes.body.token).toBeDefined();
    });

    test('5. Expired resetToken is rejected', async () => {
        const crypto = require('crypto');
        const expiredRawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(expiredRawToken).digest('hex');

        await ResetTokenModel.create({
            userId: user._id,
            email: testEmail,
            tokenHash,
            expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
            used: false
        });

        const res = await request(app)
            .post('/api/auth/reset-password')
            .send({ resetToken: expiredRawToken, newPassword: 'ValidPassword123!' });

        expect(res.statusCode).toBe(400);
        expect(res.body.message).toMatch(/Invalid or expired password reset token/i);
    });
});
