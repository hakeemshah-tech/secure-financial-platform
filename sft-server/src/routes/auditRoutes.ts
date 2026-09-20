import express from 'express';
import { protect, admin } from '../middlewares/authMiddleware';
import { getAuditLogs } from '../controllers/auditController';

const router = express.Router();

router.route('/').get(protect, admin, getAuditLogs);

export default router;
