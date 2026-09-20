import { Request, Response } from 'express';
import User from '../models/User';
import { logAudit } from '../utils/auditLogger';
import { notifyUser } from './notificationController';

// @desc    Get all users (Admin)
// @route   GET /api/users
// @access  Private/Admin
export const getUsers = async (req: Request, res: Response) => {
    try {
        const pageSize = 10;
        const page = Number(req.query.page) || 1;

        const escapeRegex = (text: string) => {
            return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
        };

        const keyword = req.query.keyword ? {
            $or: [
                { username: { $regex: escapeRegex(req.query.keyword as string), $options: 'i' } },
                { email: { $regex: escapeRegex(req.query.keyword as string), $options: 'i' } },
                { phoneNumber: { $regex: escapeRegex(req.query.keyword as string), $options: 'i' } },
                { walletAddress: { $regex: escapeRegex(req.query.keyword as string), $options: 'i' } },
            ]
        } : {};

        let statusFilter = {};
        if (req.query.status) {
            switch (req.query.status) {
                case 'active':
                    statusFilter = { isActive: true };
                    break;
                case 'inactive':
                    statusFilter = { isActive: false };
                    break;
                case 'blocked':
                    statusFilter = { isBlocked: true };
                    break;
                case 'unblocked':
                    statusFilter = { isBlocked: { $ne: true } };
                    break;
            }
        }

        console.log("Admin Search Query:", JSON.stringify(keyword));

        // Filter logic if needed (e.g. status)
        // ...

        const count = await User.countDocuments({ ...keyword, ...statusFilter });
        const users = await User.find({ ...keyword, ...statusFilter })
            .select('-password') // Exclude password
            .populate('role', 'name') // Populate role name
            .limit(pageSize)
            .skip(pageSize * (page - 1))
            .sort({ createdAt: -1 });

        res.json({ users, page, pages: Math.ceil(count / pageSize) });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get user by ID (Admin)
// @route   GET /api/users/:id
// @access  Private/Admin
export const getUserById = async (req: Request, res: Response) => {
    try {
        const user = await User.findById(req.params.id)
            .select('-password')
            .populate('role', 'name')
            .populate('referrer', 'username email');

        if (user) {
            res.json(user);
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Block/Unblock user
// @route   PATCH /api/users/:id/block
// @access  Private/Admin
export const toggleBlockUser = async (req: Request, res: Response) => {
    try {
        const user = await User.findById(req.params.id);

        if (user) {
            user.isBlocked = !user.isBlocked;
            await user.save();

            await logAudit({
                userId: (req as any).user._id,
                action: user.isBlocked ? 'BLOCK_USER' : 'UNBLOCK_USER',
                details: `User ${user.email} was ${user.isBlocked ? 'blocked' : 'unblocked'}`,
                resourceType: 'User',
                resourceId: user._id.toString(),
                ipAddress: req.ip,
                changes: { isBlocked: { old: !user.isBlocked, new: user.isBlocked } }
            });

            const blockMsg = user.isBlocked ? 'Your account has been blocked by admin.' : 'Your account has been unblocked.';
            await notifyUser(user._id.toString(), user.isBlocked ? 'Account Blocked' : 'Account Activated', blockMsg);

            res.json({ message: `User ${user.isBlocked ? 'blocked' : 'unblocked'}`, isBlocked: user.isBlocked });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete user permanently
// @route   DELETE /api/users/:id
// @access  Private/Admin
export const deleteUser = async (req: Request, res: Response) => {
    try {
        // Express 5 types params as `string | string[]` to allow for wildcard routes.
        // `:id` is a named param, so it is always a single string at runtime.
        const userId = req.params.id as string;

        // 1. Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        // 2. Check for ANY investments (active or history)
        const investmentCount = await import('../models/Investment').then(m => m.default.countDocuments({ user: userId }));
        if (investmentCount > 0) {
            res.status(400).json({ message: 'Cannot delete user. This user has existing investments in the system.' });
            return;
        }

        // 3. Check for Downline Members (Prevent Tree Breaking)
        if (user.leftChild || user.rightChild) {
            res.status(400).json({
                message: 'Cannot delete user. This user has members in their downline (binary tree). Deleting them would break the tree structure.'
            });
            return;
        }

        // 3. Send FORCE LOGOUT Notification/Message via FCM
        // We use a data message for silent handling or specific action
        if (user.fcmToken) {
            try {
                const message = {
                    data: {
                        type: 'FORCE_LOGOUT',
                        title: 'Account Deleted',
                        body: 'Your account has been deleted by the administrator.'
                    },
                    token: user.fcmToken
                };
                await import('../config/firebase').then(m => m.messaging.send(message));
                console.log(`[DeleteUser] Force logout signal sent to ${user.email}`);
            } catch (err) {
                console.error(`[DeleteUser] Failed to send force logout signal:`, err);
                // Continue deletion anyway
            }
        }

        // 4. Cleanup Parent Link (Prevent "Ghost" Nodes)
        if (user.placementParent) {
            const parent = await User.findById(user.placementParent);
            if (parent) {
                let parentModified = false;
                if (parent.leftChild && parent.leftChild.toString() === userId) {
                    parent.leftChild = undefined;
                    parentModified = true;
                    console.log(`[DeleteUser] Removed ${user.email} from Left Child of ${parent.email}`);
                }
                if (parent.rightChild && parent.rightChild.toString() === userId) {
                    parent.rightChild = undefined;
                    parentModified = true;
                    console.log(`[DeleteUser] Removed ${user.email} from Right Child of ${parent.email}`);
                }

                if (parentModified) {
                    await parent.save();
                }
            }
        }

        // 5. Delete the User
        await User.findByIdAndDelete(userId);

        // 5. Audit Log
        await logAudit({
            userId: (req as any).user._id,
            action: 'DELETE_USER',
            details: `User ${user.email} was permanently deleted by admin.`,
            resourceType: 'User',
            resourceId: userId,
            ipAddress: req.ip,
            changes: { old: user.toObject() }
        });

        res.json({ message: 'User deleted successfully' });

    } catch (error: any) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update User Wallet Address (Admin)
// @route   PATCH /api/users/:id/wallet
// @access  Private/Admin
export const updateUserWallet = async (req: Request, res: Response) => {
    try {
        const { walletAddress } = req.body;
        const userId = req.params.id;

        if (!walletAddress) {
            return res.status(400).json({ message: 'Wallet address is required' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if wallet already used by another user
        const existingUser = await User.findOne({ walletAddress });
        if (existingUser && existingUser._id.toString() !== userId) {
            return res.status(400).json({ message: 'Wallet address already in use by another user' });
        }

        const oldWallet = user.walletAddress;
        user.walletAddress = walletAddress;
        await user.save();

        await logAudit({
            userId: (req as any).user._id,
            action: 'UPDATE_WALLET',
            details: `Admin updated wallet for user ${user.email}`,
            resourceType: 'User',
            resourceId: user._id.toString(),
            ipAddress: req.ip,
            changes: { walletAddress: { old: oldWallet, new: walletAddress } }
        });

        res.json({ message: 'Wallet updated successfully', walletAddress });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
