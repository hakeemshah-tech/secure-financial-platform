import express from 'express';
import { protect, admin } from '../middlewares/authMiddleware';
import {
    requestEmailChange,
    getEmailChangeRequests,
    approveEmailChange,
    rejectEmailChange,
    resendVerificationEmailAction,
    verifyEmailChange
} from '../controllers/emailChangeController';

const router = express.Router();

router.post('/request', requestEmailChange);
router.get('/admin', protect, admin, getEmailChangeRequests);
router.put('/:id/approve', protect, admin, approveEmailChange);
router.put('/:id/reject', protect, admin, rejectEmailChange);
router.put('/:id/resend-verification', protect, admin, resendVerificationEmailAction);
router.post('/verify', verifyEmailChange);

export default router;
