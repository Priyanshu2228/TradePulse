const express = require('express');
const asyncHandler = require('express-async-handler');
const {
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
} = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/signup', asyncHandler(signup));
router.post('/verify-otp', asyncHandler(verifySignupOtp));
router.post('/resend-otp', asyncHandler(resendOtp));
router.post('/login', asyncHandler(login));
router.post('/send-login-otp', asyncHandler(sendLoginOtp));
router.post('/verify-login-otp', asyncHandler(verifyLoginOtp));
router.post('/forgot-password', asyncHandler(forgotPassword));
router.post('/verify-reset-otp', asyncHandler(verifyResetOtp));
router.post('/reset-password', asyncHandler(resetPassword));
router.get('/me', authenticateToken, asyncHandler(getMe));

module.exports = router;
