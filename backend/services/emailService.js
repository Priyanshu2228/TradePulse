let nodemailer = null;
try {
    nodemailer = require('nodemailer');
} catch (_) {
    // Nodemailer module loading check
}

/**
 * Checks whether SMTP credentials are fully configured in process.env
 */
function isSmtpConfigured() {
    return Boolean(
        process.env.SMTP_HOST &&
        process.env.SMTP_USER &&
        process.env.SMTP_PASS &&
        process.env.SMTP_HOST.trim() !== '' &&
        process.env.SMTP_USER.trim() !== '' &&
        process.env.SMTP_PASS.trim() !== ''
    );
}

/**
 * Creates a Nodemailer SMTP transporter using active environment variables
 */
function createTransporter() {
    if (!nodemailer || !isSmtpConfigured()) {
        return null;
    }

    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = process.env.SMTP_SECURE === 'true' || process.env.SMTP_SECURE === true;

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
}

/**
 * Generates subject, text, and responsive HTML email content based on OTP type
 */
function getEmailTemplate(type, otpCode) {
    let title = 'Verification Code';
    let subject = 'TradePulse - OTP Verification';
    let message = 'Your one-time verification code is:';
    let purposeText = 'This code is required to complete your action on TradePulse.';
    let warningText = 'Do not share this OTP with anyone. TradePulse support will never ask for your OTP.';

    if (type === 'EMAIL_VERIFICATION') {
        title = 'Verify Your Email';
        subject = 'TradePulse - Verify Your Email Address';
        message = 'Welcome to TradePulse! Use the verification code below to activate your account:';
        purposeText = 'Verify your email address to unlock your ₹100,000 virtual paper trading balance.';
    } else if (type === 'LOGIN_OTP') {
        title = 'Login Verification';
        subject = 'TradePulse - Login Verification OTP';
        message = 'Use the verification code below to log in to your TradePulse account:';
        purposeText = 'If you did not request this login code, please secure your account immediately.';
    } else if (type === 'PASSWORD_RESET') {
        title = 'Password Reset Request';
        subject = 'TradePulse - Password Reset OTP';
        message = 'We received a request to reset your password. Use the code below to proceed:';
        purposeText = 'If you did not request a password reset, you can safely ignore this email.';
    }

    const textContent = `TradePulse - ${title}\n\n${message}\n\nOTP Code: ${otpCode}\n\nThis code is valid for 10 minutes.\n\n${purposeText}\n\nSecurity Notice: ${warningText}`;

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>${subject}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 30px 15px;">
        <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <div style="background-color: #0f172a; padding: 24px 30px; text-align: center;">
                <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; margin: 0; letter-spacing: 0.5px;">
                    <span style="background-color: #0284c7; color: #ffffff; padding: 4px 10px; border-radius: 6px; margin-right: 8px;">TP</span>
                    TradePulse
                </h1>
            </div>
            <div style="padding: 30px;">
                <h2 style="font-size: 20px; color: #0f172a; margin-top: 0; margin-bottom: 16px;">${title}</h2>
                <p style="font-size: 15px; color: #475569; line-height: 1.6; margin-bottom: 24px;">
                    ${message}
                </p>
                <div style="text-align: center; margin: 28px 0;">
                    <div style="font-size: 34px; font-weight: 700; letter-spacing: 8px; color: #0284c7; background-color: #f1f5f9; border: 1px solid #cbd5e1; padding: 14px 24px; border-radius: 8px; display: inline-block; font-family: monospace;">
                        ${otpCode}
                    </div>
                    <div style="font-size: 13px; color: #64748b; margin-top: 10px; font-weight: 500;">
                        ⏱️ Valid for <strong>10 minutes</strong>
                    </div>
                </div>
                <p style="font-size: 14px; color: #475569; line-height: 1.5; margin-bottom: 24px;">
                    ${purposeText}
                </p>
                <div style="background-color: #fffbe6; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; font-size: 13px; color: #92400e;">
                    <strong>Security Warning:</strong> ${warningText}
                </div>
            </div>
            <div style="background-color: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
                TradePulse • Educational Paper Trading Platform
            </div>
        </div>
    </body>
    </html>
    `;

    return { subject, text: textContent, html: htmlContent };
}

/**
 * Sends an OTP email via Nodemailer if SMTP is configured, or logs to dev console if unconfigured.
 */
async function sendOtpEmail(toEmail, otpCode, type = 'EMAIL_VERIFICATION') {
    const { subject, text, html } = getEmailTemplate(type, otpCode);

    if (isSmtpConfigured()) {
        const transporter = createTransporter();
        if (!transporter) {
            throw new Error('Failed to initialize SMTP transporter');
        }

        const fromAddress = process.env.SMTP_FROM || `"TradePulse" <${process.env.SMTP_USER}>`;

        try {
            await transporter.sendMail({
                from: fromAddress,
                to: toEmail,
                subject,
                text,
                html
            });
            console.log(`[EmailService] OTP email sent successfully to ${toEmail} (Type: ${type})`);
            return { success: true, method: 'SMTP' };
        } catch (err) {
            console.error(`[EmailService] SMTP delivery failed to ${toEmail}: ${err.message}`);
            throw new Error(`Email delivery failed: ${err.message}`);
        }
    } else {
        // Development Console Fallback
        console.log(`[EmailService] SMTP credentials not configured. Operating in development fallback mode.`);
        console.log(`\n==================================================`);
        console.log(`[DEV OTP LOG] OTP for ${toEmail} (${type}): ${otpCode}`);
        console.log(`==================================================\n`);
        return { success: true, method: 'DEV_FALLBACK' };
    }
}

module.exports = {
    sendOtpEmail,
    isSmtpConfigured,
    createTransporter,
    getEmailTemplate
};
