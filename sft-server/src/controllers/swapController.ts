import { Request, Response } from 'express';
import SwapRequest from '../models/SwapRequest';
import Transaction from '../models/Transaction';
import User from '../models/User';
import { logAudit } from '../utils/auditLogger';
import { notifyUser, notifyAdmins } from './notificationController';
import { isTxHashUnique } from '../services/validationService';

// @desc    Create new swap request
// @route   POST /api/swaps
// @access  Private
export const createSwapRequest = async (req: Request, res: Response) => {
    const { amount, fromToken, toToken, walletAddress, userTxHash } = req.body;
    const userId = (req as any).user._id;

    console.log('🔄 Creating swap request:', { userId, amount, fromToken, toToken, walletAddress, userTxHash });

    try {
        if (userTxHash && !(await isTxHashUnique(userTxHash))) {
            return res.status(400).json({ message: 'Transaction hash already used.' });
        }

        // Validate user wallet
        let finalWalletAddress = walletAddress;
        if (!finalWalletAddress) {
            const user = await User.findById(userId);
            if (user && user.walletAddress) {
                finalWalletAddress = user.walletAddress;
            } else {
                return res.status(400).json({ message: 'Wallet address required' });
            }
        }

        const swapRequest = await SwapRequest.create({
            user: userId,
            walletAddress: finalWalletAddress,
            amount,
            fromToken,
            toToken,
            status: 'PENDING',
            userTxHash
        });

        // Log Transaction
        await Transaction.create({
            user: userId,
            type: 'SWAP',
            amountSFT: fromToken === 'SFT' ? amount : 0, // Just logging SFT amount involved
            amountSFTAllocated: toToken === 'SFT' ? amount : 0,
            status: 'PENDING',
            txHash: userTxHash,
            swapRequest: swapRequest._id // [FIX] Link to SwapRequest so validation passes
        });

        await logAudit({
            userId: userId,
            action: 'CREATE_SWAP_REQUEST',
            details: `User requested swap of ${amount} ${fromToken} to ${toToken}`,
            resourceType: 'SwapRequest',
            resourceId: swapRequest._id.toString(),
            ipAddress: req.ip,
            changes: { amount, fromToken, toToken, walletAddress: finalWalletAddress }
        });

        await notifyUser(userId, 'Swap Request Submitted', `You requested to swap ${amount} ${fromToken}.`);

        // Notify Admins
        await notifyAdmins('New Swap Request', `User requested swap of ${amount} ${fromToken} to ${toToken}.`, 'INFO');

        res.status(201).json(swapRequest);
    } catch (error: any) {
        console.error('❌ Error creating swap request:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get my swap requests
// @route   GET /api/swaps/my
// @access  Private
export const getMySwapRequests = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user._id;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        const total = await SwapRequest.countDocuments({ user: userId });
        const pages = Math.ceil(total / limit);

        const requests = await SwapRequest.find({ user: userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json({
            requests,
            pagination: {
                page,
                limit,
                pages,
                total
            }
        });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all swap requests (Admin)
// @route   GET /api/swaps/admin
// @access  Private/Admin
export const getAllSwapRequests = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const search = req.query.search as string; // Search query
        const skip = (page - 1) * limit;

        let query: any = {};

        if (search) {
            const users = await User.find({
                $or: [
                    { username: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                    { phoneNumber: { $regex: search, $options: 'i' } },
                    { walletAddress: { $regex: search, $options: 'i' } }
                ]
            }).select('_id');

            const userIds = users.map(u => u._id);

            query = {
                $or: [
                    { user: { $in: userIds } },
                    { walletAddress: { $regex: search, $options: 'i' } }
                ]
            };
        }

        const total = await SwapRequest.countDocuments(query);
        const pages = Math.ceil(total / limit);

        const requests = await SwapRequest.find(query)
            .populate('user', 'username email walletAddress')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json({
            requests,
            pagination: {
                page,
                limit,
                pages,
                total
            }
        });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }

};

// @desc    Get Admin User Swap Requests
// @route   GET /api/swaps/admin/user/:userId
// @access  Private/Admin
export const getAdminUserSwaps = async (req: Request, res: Response) => {
    try {
        const userId = req.params.userId;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        const total = await SwapRequest.countDocuments({ user: userId });
        const pages = Math.ceil(total / limit);

        const requests = await SwapRequest.find({ user: userId })
            .populate('user', 'username email walletAddress')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json({
            requests,
            pagination: {
                page,
                limit,
                pages,
                total
            }
        });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Approve Swap Request
// @route   PUT /api/swaps/:id/approve
// @access  Private/Admin
export const approveSwap = async (req: Request, res: Response) => {
    try {
        const swap = await SwapRequest.findById(req.params.id);
        if (!swap) return res.status(404).json({ message: 'Swap request not found' });

        if (swap.status !== 'PENDING') {
            return res.status(400).json({ message: `Cannot approve swap with status ${swap.status}` });
        }

        swap.status = 'APPROVED';
        await swap.save();

        await logAudit({
            userId: (req as any).user._id,
            action: 'APPROVE_SWAP',
            details: `Admin approved swap request ${swap._id}`,
            resourceType: 'SwapRequest',
            resourceId: swap._id.toString(),
            ipAddress: req.ip,
            changes: { status: { old: 'PENDING', new: 'APPROVED' } }
        });

        res.json(swap);

        // Notify User
        await notifyUser(
            (swap.user as any)._id,
            'Swap Request Approved',
            `Your swap request for ${swap.amount} ${swap.fromToken} has been approved.`
        );
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Reject Swap Request
// @route   PUT /api/swaps/:id/reject
// @access  Private/Admin
export const rejectSwap = async (req: Request, res: Response) => {
    try {
        const swap = await SwapRequest.findById(req.params.id);
        if (!swap) return res.status(404).json({ message: 'Swap request not found' });

        if (swap.status !== 'PENDING') {
            return res.status(400).json({ message: `Cannot reject swap with status ${swap.status}` });
        }

        swap.status = 'REJECTED';
        await swap.save();

        await logAudit({
            userId: (req as any).user._id,
            action: 'REJECT_SWAP',
            details: `Admin rejected swap request ${swap._id}`,
            resourceType: 'SwapRequest',
            resourceId: swap._id.toString(),
            ipAddress: req.ip,
            changes: { status: { old: 'PENDING', new: 'REJECTED' } }
        });

        res.json(swap);

        // Notify User
        await notifyUser(
            (swap.user as any)._id,
            'Swap Request Rejected',
            `Your swap request has been rejected.`,
            'ERROR'
        );
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Complete Swap (Admin sends tokens)
// @route   PUT /api/swaps/:id/complete
// @access  Private/Admin
export const completeSwap = async (req: Request, res: Response) => {
    const { adminTxHash } = req.body;
    try {
        const swap = await SwapRequest.findById(req.params.id);
        if (!swap) return res.status(404).json({ message: 'Swap request not found' });

        if (adminTxHash && !(await isTxHashUnique(adminTxHash))) {
            return res.status(400).json({ message: 'Transaction hash already used.' });
        }

        if (swap.status !== 'APPROVED') {
            return res.status(400).json({ message: `Cannot complete swap with status ${swap.status}` });
        }

        swap.status = 'COMPLETED';
        swap.adminTxHash = adminTxHash;
        await swap.save();

        // Log Transaction Completion - Finding the associated transaction might be tricky without ID, but we can assume Recent PENDING for this user/amount?
        // Better to store Transaction ID in SwapRequest, but strictly not required if we just log a NEW completed transaction or trust the logs.
        // Let's just create a new COMPLETED log for the Outgoing part? Or update the old one?
        // Simpler: Just update status based on user + type=SWAP + txHash=userTxHash
        if (swap.userTxHash) {
            await Transaction.findOneAndUpdate(
                { txHash: swap.userTxHash, type: 'SWAP' },
                { status: 'COMPLETED' }
            );
        }

        await logAudit({
            userId: (req as any).user._id,
            action: 'COMPLETE_SWAP',
            details: `Admin completed swap request ${swap._id}`,
            resourceType: 'SwapRequest',
            resourceId: swap._id.toString(),
            ipAddress: req.ip,
            changes: { status: { old: 'APPROVED', new: 'COMPLETED' }, adminTxHash }
        });

        res.json(swap);

        // Notify User
        await notifyUser(
            (swap.user as any)._id,
            'Swap Request Completed',
            `Your swap transaction has been completed successfully.`,
            'SUCCESS'
        );
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
