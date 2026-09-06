const nodemailer = require('nodemailer');
const { sendOtpEmail, isSmtpConfigured, getEmailTemplate } = require('../services/emailService');

jest.mock('nodemailer');

describe('EmailService SMTP & Development Fallback Suite', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        delete process.env.SMTP_HOST;
        delete process.env.SMTP_USER;
        delete process.env.SMTP_PASS;
        delete process.env.SMTP_PORT;
        delete process.env.SMTP_SECURE;
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    test('should detect when SMTP is unconfigured', () => {
        expect(isSmtpConfigured()).toBe(false);
    });

    test('should detect when SMTP is configured', () => {
        process.env.SMTP_HOST = 'smtp.gmail.com';
        process.env.SMTP_USER = 'trader@gmail.com';
        process.env.SMTP_PASS = 'app-password-xyz';

        expect(isSmtpConfigured()).toBe(true);
    });

    test('should use dev console fallback when SMTP is unconfigured', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        const result = await sendOtpEmail('student@college.edu', '123456', 'EMAIL_VERIFICATION');

        expect(result.success).toBe(true);
        expect(result.method).toBe('DEV_FALLBACK');
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
    });

    test('should call Nodemailer sendMail when SMTP is configured for EMAIL_VERIFICATION', async () => {
        process.env.SMTP_HOST = 'smtp.gmail.com';
        process.env.SMTP_PORT = '587';
        process.env.SMTP_USER = 'trader@gmail.com';
        process.env.SMTP_PASS = 'app-password-xyz';

        const sendMailMock = jest.fn().mockResolvedValue({ messageId: 'mock-msg-123' });
        nodemailer.createTransport.mockReturnValue({
            sendMail: sendMailMock
        });

        const result = await sendOtpEmail('student@college.edu', '654321', 'EMAIL_VERIFICATION');

        expect(result.success).toBe(true);
        expect(result.method).toBe('SMTP');
        expect(nodemailer.createTransport).toHaveBeenCalledWith({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
                user: 'trader@gmail.com',
                pass: 'app-password-xyz'
            }
        });
        expect(sendMailMock).toHaveBeenCalledWith(
            expect.objectContaining({
                to: 'student@college.edu',
                subject: expect.stringContaining('Verify Your Email'),
                html: expect.stringContaining('654321')
            })
        );
    });

    test('should call Nodemailer sendMail for LOGIN_OTP and PASSWORD_RESET', async () => {
        process.env.SMTP_HOST = 'smtp.gmail.com';
        process.env.SMTP_USER = 'trader@gmail.com';
        process.env.SMTP_PASS = 'app-password-xyz';

        const sendMailMock = jest.fn().mockResolvedValue({ messageId: 'mock-msg-456' });
        nodemailer.createTransport.mockReturnValue({
            sendMail: sendMailMock
        });

        await sendOtpEmail('user@domain.com', '112233', 'LOGIN_OTP');
        expect(sendMailMock).toHaveBeenCalledWith(
            expect.objectContaining({
                subject: expect.stringContaining('Login Verification'),
                html: expect.stringContaining('112233')
            })
        );

        await sendOtpEmail('user@domain.com', '445566', 'PASSWORD_RESET');
        expect(sendMailMock).toHaveBeenCalledWith(
            expect.objectContaining({
                subject: expect.stringContaining('Password Reset'),
                html: expect.stringContaining('445566')
            })
        );
    });

    test('should throw error when Nodemailer sendMail fails', async () => {
        process.env.SMTP_HOST = 'smtp.gmail.com';
        process.env.SMTP_USER = 'trader@gmail.com';
        process.env.SMTP_PASS = 'app-password-xyz';

        const sendMailMock = jest.fn().mockRejectedValue(new Error('Invalid SMTP credentials'));
        nodemailer.createTransport.mockReturnValue({
            sendMail: sendMailMock
        });

        await expect(sendOtpEmail('user@domain.com', '999999', 'EMAIL_VERIFICATION')).rejects.toThrow(
            'Email delivery failed: Invalid SMTP credentials'
        );
    });

    test('should generate proper email templates for all types', () => {
        const verifyTemplate = getEmailTemplate('EMAIL_VERIFICATION', '123456');
        expect(verifyTemplate.subject).toContain('Verify Your Email');
        expect(verifyTemplate.html).toContain('123456');

        const loginTemplate = getEmailTemplate('LOGIN_OTP', '654321');
        expect(loginTemplate.subject).toContain('Login Verification');
        expect(loginTemplate.html).toContain('654321');

        const resetTemplate = getEmailTemplate('PASSWORD_RESET', '789012');
        expect(resetTemplate.subject).toContain('Password Reset');
        expect(resetTemplate.html).toContain('789012');
    });
});
