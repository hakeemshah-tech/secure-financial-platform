import express from 'express';
import {
    authWallet,
    registerAdmin,
    registerUser,
    loginUser,
    linkWallet,
    unlinkWallet,
    getAdminWallet,
    getMe,
    logoutUser,
    verifyEmail,
    forgotPassword,
    resetPassword,
    verifyAdminOtp,
    resendVerificationEmail,
    changePassword
} from '../controllers/authController';
import { protect } from '../middlewares/authMiddleware';
import { body } from 'express-validator';
import { validateRequest } from '../middlewares/validationMiddleware';
const router = express.Router();

router.post('/register', [
    body('email').isEmail().withMessage('Please include a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('username').notEmpty().withMessage('Username is required'),
], validateRequest, registerUser);
router.post('/login', [
    body('email').isEmail().withMessage('Please include a valid email'),
    body('password').exists().withMessage('Password is required'),
], validateRequest, loginUser);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerificationEmail);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/verify-otp', verifyAdminOtp);
router.post('/change-password', protect, changePassword);
router.post('/link-wallet', protect, linkWallet);
router.post('/unlink-wallet', protect, unlinkWallet);
router.post('/wallet', authWallet);
router.post('/admin/register', registerAdmin);
router.get('/admin-wallet', getAdminWallet);
router.get('/me', protect, getMe);
router.post('/logout', protect, logoutUser);

export default router;
