import express from 'express';
import { protect, admin } from '../middlewares/authMiddleware';
import { getEarningsSummary, getEarningsHistory, withdrawEarnings, transferToAvailable, getAllWithdrawals, approveWithdrawal, completeWithdrawal, rejectWithdrawal, getAdminUserEarningsSummary } from '../controllers/earningsController';

const router = express.Router();

router.get('/summary', protect, getEarningsSummary);
router.get('/history', protect, getEarningsHistory);
router.post('/withdraw', protect, withdrawEarnings);
router.post('/transfer', protect, transferToAvailable);

// Admin Routes
router.get('/admin/withdrawals', protect, admin, getAllWithdrawals);
router.get('/admin/summary/:userId', protect, admin, getAdminUserEarningsSummary);
router.put('/withdrawals/:id/approve', protect, admin, approveWithdrawal);
router.put('/withdrawals/:id/complete', protect, admin, completeWithdrawal);
router.put('/withdrawals/:id/reject', protect, admin, rejectWithdrawal);

export default router;
