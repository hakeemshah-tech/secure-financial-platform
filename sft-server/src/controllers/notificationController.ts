import { Request, Response } from 'express';
import User from '../models/User';
import Notification from '../models/Notification';
import Role from '../models/Role'; // [NEW] Import Role
import { messaging } from '../config/firebase';

/**
 * Helper to send notification to ALL Admins
 */
export const notifyAdmins = async (title: string, body: string, type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' = 'INFO') => {
    try {
        const adminRole = await Role.findOne({ name: 'admin' });
        if (!adminRole) return;

        // Find all admins
        const admins = await User.find({ role: adminRole._id });
        if (!admins.length) return;

        // Loop through all admins and notify them
        for (const admin of admins) {
            await notifyUser(admin._id.toString(), title, body, type);
        }
        console.log(`[NotifyAdmins] Sent notification to ${admins.length} admins: ${title}`);
    } catch (error) {
        console.error('Failed to notify admins:', error);
    }
};

/**
 * Internal helper to send notification to a user
 */
export const notifyUser = async (userId: string, title: string, body: string, type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' = 'INFO') => {
    try {
        // 1. Save to Database
        await Notification.create({
            user: userId,
            title,
            body,
            type,
            isRead: false
        });

        // 2. Send Push Notification
        const user = await User.findById(userId);
        if (user && user.fcmToken) {
            const message = {
                notification: { title, body },
                token: user.fcmToken,
            };
            await messaging.send(message);
            console.log(`Notification sent to user ${userId}: ${title}`);
        }
    } catch (error) {
        console.error(`Failed to notify user ${userId}:`, error);
        // Don't throw, just log
    }
};

/**
 * @desc    Subscribe user to notifications (Save FCM Token)
 * @route   POST /api/notifications/subscribe
 * @access  Private
 */
export const subscribeToNotifications = async (req: Request, res: Response): Promise<void> => {
    try {
        const { fcmToken } = req.body;
        const userId = (req as any).user._id;

        if (!fcmToken) {
            res.status(400).json({ message: 'FCM Token is required' });
            return;
        }

        const user = await User.findById(userId);

        if (user) {
            user.fcmToken = fcmToken;
            await user.save();
            res.status(200).json({ message: 'Subscribed to notifications' });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Error subscribing to notifications:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Send a test notification to a specific user (or self)
// @route   POST /api/notifications/send
// @access  Private (Admin for others, Self for user)
export const sendNotification = async (req: Request, res: Response): Promise<void> => {
    try {
        let { userId, title, body } = req.body;
        const requester = (req as any).user;

        // Security: If not admin, FORCE userId to be themselves
        const isAdmin = requester.role && requester.role.name.toLowerCase() === 'admin';

        if (!isAdmin || !userId) {
            userId = requester._id.toString();
        }

        const user = await User.findById(userId);

        if (!user || !user.fcmToken) {
            res.status(404).json({ message: 'User or FCM Token not found (Please allow notifications in browser)' });
            return;
        }

        const message = {
            notification: {
                title: title || 'Test Notification',
                body: body || 'This is a test notification from SFT.',
            },
            token: user.fcmToken,
        };

        await messaging.send(message);

        // Also save to DB for history
        await Notification.create({
            user: userId,
            title: title || 'Test Notification',
            body: body || 'This is a test notification.',
            type: 'INFO',
            isRead: false
        });

        res.status(200).json({ message: 'Notification sent successfully' });

    } catch (error: any) {
        console.error('Error sending notification:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/**
 * @desc    Get unread notifications for a user
 * @route   GET /api/notifications/unread
 * @access  Private
 */
export const getUnreadNotifications = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user._id;
        // Fetch unread notifications, sorted by newest first
        const notifications = await Notification.find({ user: userId, isRead: false })
            .sort({ createdAt: -1 })
            .limit(20); // Limit to recent 20 to avoid overwhelm in dropdown

        // Also get count
        const count = await Notification.countDocuments({ user: userId, isRead: false });

        res.json({ notifications, count });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * @desc    Mark notifications as read
 * @route   PUT /api/notifications/read
 * @access  Private
 */
export const markNotificationsRead = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user._id;
        const { notificationIds } = req.body; // Optional array of IDs, if empty mark all

        if (notificationIds && Array.isArray(notificationIds) && notificationIds.length > 0) {
            await Notification.updateMany(
                { _id: { $in: notificationIds }, user: userId },
                { isRead: true }
            );
        } else {
            // Mark ALL as read
            await Notification.updateMany(
                { user: userId, isRead: false },
                { isRead: true }
            );
        }

        res.json({ message: 'Notifications marked as read' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
