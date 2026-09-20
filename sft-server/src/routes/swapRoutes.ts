import express from 'express';
import { protect, admin } from '../middlewares/authMiddleware';
import {
    createSwapRequest,
    getMySwapRequests,
    getAllSwapRequests,
    approveSwap,
    rejectSwap,
    completeSwap,
    getAdminUserSwaps
} from '../controllers/swapController';

const router = express.Router();

router.post('/', protect, createSwapRequest);
router.get('/my', protect, getMySwapRequests);
router.get('/admin', protect, admin, getAllSwapRequests);
router.get('/admin/user/:userId', protect, admin, getAdminUserSwaps);
router.put('/:id/approve', protect, admin, approveSwap);
router.put('/:id/reject', protect, admin, rejectSwap);
router.put('/:id/complete', protect, admin, completeSwap);

export default router;
