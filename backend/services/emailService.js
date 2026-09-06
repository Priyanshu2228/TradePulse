const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

/**
 * Checks whether Resend is configured.
 */
function isResendConfigured() {
    return Boolean(
        process.env.RESEND_API_KEY &&
        process.env.RESEND_API_KEY.trim() !== ''
    );
}

/**
 * Generates subject, text, and responsive HTML email content based on OTP type.
 */
function getEmailTemplate(type, otpCode) {
    let title = 'Verification Code';
    let subject = 'TradePulse - OTP Verification';
    let message = 'Your one-time verification code is:';
    let purposeText = 'This code is required to complete your action on TradePulse.';
    let warningText =
        'Do not share this OTP with anyone. TradePulse support will never ask for your OTP.';

    if (type === 'EMAIL_VERIFICATION') {
        title = 'Verify Your Email';
        subject = 'TradePulse - Verify Your Email Address';
        message =
            'Welcome to TradePulse! Use the verification code below to activate your account:';
        purposeText =
            'Verify your email address to unlock your ₹100,000 virtual paper trading balance.';
    } else if (type === 'LOGIN_OTP') {
        title = 'Login Verification';
        subject = 'TradePulse - Login Verification OTP';
        message =
            'Use the verification code below to log in to your TradePulse account:';
        purposeText =
            'If you did not request this login code, please secure your account immediately.';
    } else if (type === 'PASSWORD_RESET') {
        title = 'Password Reset Request';
        subject = 'TradePulse - Password Reset OTP';
        message =
            'We received a request to reset your password. Use the code below to proceed:';
        purposeText =
            'If you did not request a password reset, you can safely ignore this email.';
    }

    const textContent = `TradePulse - ${title}

${message}

OTP Code: ${otpCode}

This code is valid for 10 minutes.

${purposeText}

Security Notice: ${warningText}`;

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
                <h2 style="font-size: 20px; color: #0f172a; margin-top: 0; margin-bottom: 16px;">
                    ${title}
                </h2>

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

    return {
        subject,
        text: textContent,
        html: htmlContent
    };
}

/**
 * Sends an OTP email through the Resend HTTPS API.
 */
async function sendOtpEmail(
    toEmail,
    otpCode,
    type = 'EMAIL_VERIFICATION'
) {
    const { subject, text, html } = getEmailTemplate(type, otpCode);

    if (!isResendConfigured()) {
        console.log(
            '[EmailService] RESEND_API_KEY is not configured. Using development fallback.'
        );

        console.log('\n==================================================');
        console.log(
            `[DEV OTP LOG] OTP for ${toEmail} (${type}): ${otpCode}`
        );
        console.log('==================================================\n');

        return {
            success: true,
            method: 'DEV_FALLBACK'
        };
    }

    try {
        const fromAddress =
            process.env.RESEND_FROM ||
            'TradePulse <onboarding@resend.dev>';

        const { data, error } = await resend.emails.send({
            from: fromAddress,
            to: [toEmail],
            subject,
            text,
            html
        });

        if (error) {
            console.error(
                `[EmailService] Resend delivery failed to ${toEmail}: ${error.message}`
            );

            throw new Error(`Email delivery failed: ${error.message}`);
        }

        console.log(
            `[EmailService] OTP email sent successfully to ${toEmail} (Type: ${type}, ID: ${data?.id || 'unknown'})`
        );

        return {
            success: true,
            method: 'RESEND',
            id: data?.id
        };
    } catch (err) {
        console.error(
            `[EmailService] Resend delivery failed to ${toEmail}: ${err.message}`
        );

        throw new Error(`Email delivery failed: ${err.message}`);
    }
}

module.exports = {
    sendOtpEmail,
    isResendConfigured,
    getEmailTemplate
};