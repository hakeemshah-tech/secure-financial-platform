import express from 'express';
import { getAdminStats } from '../controllers/dashboardController';
import { protect, admin } from '../middlewares/authMiddleware';

const router = express.Router();

router.get('/stats', protect, admin, getAdminStats);

export default router;
