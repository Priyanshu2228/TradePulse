const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const { app } = require('../index');
const { UserModel } = require('../models/User');
const { AccountModel } = require('../models/Account');
const { LedgerModel } = require('../models/Ledger');

jest.setTimeout(60000);

let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
});

afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
});

afterEach(async () => {
    await UserModel.deleteMany({});
    await AccountModel.deleteMany({});
    await LedgerModel.deleteMany({});
});

describe('Requirement 9 & 2: Account Funding & Available Balance Invariant', () => {
    test('Initial user signup and OTP verification creates ₹100,000 totalBalance, 0 blockedBalance, and matching INITIAL_DEPOSIT ledger record', async () => {
        const { createOtp } = require('../services/otpService');

        const signupRes = await request(app)
            .post('/api/auth/signup')
            .send({
                name: 'Test Trader',
                email: 'trader@tradepulse.io',
                password: 'password123'
            });

        expect(signupRes.status).toBe(201);

        const rawOtp = await createOtp('trader@tradepulse.io', 'EMAIL_VERIFICATION');

        const res = await request(app)
            .post('/api/auth/verify-otp')
            .send({
                email: 'trader@tradepulse.io',
                otp: rawOtp
            });

        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
        expect(res.body.account.totalBalance).toBe(100000.00);
        expect(res.body.account.blockedBalance).toBe(0.00);
        expect(res.body.account.availableBalance).toBe(100000.00);

        const dbAccount = await AccountModel.findOne({ userId: res.body.user.id });
        expect(dbAccount).toBeDefined();
        expect(dbAccount.availableBalance).toBe(100000.00);

        const ledger = await LedgerModel.findOne({ userId: res.body.user.id, type: 'INITIAL_DEPOSIT' });
        expect(ledger).toBeDefined();
        expect(ledger.amount).toBe(100000.00);
        expect(ledger.balanceAfter).toBe(100000.00);
    });
});
