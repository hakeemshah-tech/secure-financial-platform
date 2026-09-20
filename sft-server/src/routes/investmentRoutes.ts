import express from 'express';
import {
    createInvestment,
    getMyInvestments,
    getAllInvestments,
    approveInvestment,
    rejectInvestment,
    confirmPayment,
    completeInvestment,
    cancelInvestment,
    getTransactions,
    cancelMyInvestment,
    getAllTransactions,
    requestWithdrawal,
    approveWithdrawal,
    completeWithdrawal,
    getAdminUserInvestments,
    getAdminUserTransactions,
    adminCreateInvestment
} from '../controllers/investmentController';
import { protect, admin } from '../middlewares/authMiddleware';

const router = express.Router();

// User routes
router.post('/', protect, createInvestment);
router.get('/my', protect, getMyInvestments);
router.get('/transactions', protect, getTransactions);
router.put('/:id/payment', protect, confirmPayment);
router.put('/:id/payment', protect, confirmPayment);
router.put('/:id/cancel-my', protect, cancelMyInvestment);
router.put('/:id/withdraw-request', protect, requestWithdrawal);

// Admin routes
router.post('/admin/add', protect, admin, adminCreateInvestment);
router.get('/admin', protect, admin, getAllInvestments);
router.get('/admin/user/:userId', protect, admin, getAdminUserInvestments);
router.get('/admin/user/:userId/transactions', protect, admin, getAdminUserTransactions);
router.get('/admin/transactions', protect, admin, getAllTransactions);
router.put('/:id/approve', protect, admin, approveInvestment);
router.put('/:id/reject', protect, admin, rejectInvestment);
router.put('/:id/cancel', protect, admin, cancelInvestment);
router.put('/:id/complete', protect, admin, completeInvestment);
router.put('/:id/withdraw-approve', protect, admin, approveWithdrawal);
router.put('/:id/withdraw-complete', protect, admin, completeWithdrawal);

export default router;
