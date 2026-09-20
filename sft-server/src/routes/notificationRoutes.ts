import express from 'express';
import { subscribeToNotifications, sendNotification, getUnreadNotifications, markNotificationsRead } from '../controllers/notificationController';
import { protect, admin } from '../middlewares/authMiddleware';

const router = express.Router();

router.post('/subscribe', protect, subscribeToNotifications);
// router.post('/send', protect, admin, sendNotification); // ORIGINAL
router.post('/send', protect, sendNotification); // [MODIFIED] Allow all users to trigger, controller will handle permission check
router.get('/unread', protect, getUnreadNotifications);
router.put('/read', protect, markNotificationsRead);

export default router;
