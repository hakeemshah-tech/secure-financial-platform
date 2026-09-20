import { Request, Response } from 'express';
import Transaction from '../models/Transaction';
import User from '../models/User';
import IncomeSettings from '../models/IncomeSettings';
import mongoose from 'mongoose';
import { logAudit } from '../utils/auditLogger';
import { notifyUser, notifyAdmins } from './notificationController';
import { isTxHashUnique } from '../services/validationService';
import { canWithdraw } from '../services/incomeService';

// @desc    Get Earnings Summary
// @route   GET /api/earnings/summary
// @access  Private
export const getEarningsSummary = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user._id;
        const currentUser = await User.findById(userId).select('maxIncomeLimit totalEarnedIncome');

        // 1. Calculate Total Income (All Income Sources)
        const earnings = await Transaction.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(userId),
                    type: { $in: ['REFERRAL_REWARD', 'MATURITY_PAYOUT', 'ROI', 'LEVEL_INCOME', 'MATCHING_INCOME'] },
                    status: 'COMPLETED'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$amountSFT" }
                }
            }
        ]);
        const totalIncome = earnings.length > 0 ? earnings[0].total : 0;

        // 1.5 Calculate Total Referral Earnings (Specific)
        const referralEarnings = await Transaction.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(userId),
                    type: 'REFERRAL_REWARD',
                    status: 'COMPLETED'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$amountSFT" }
                }
            }
        ]);
        const totalReferralEarnings = referralEarnings.length > 0 ? referralEarnings[0].total : 0;

        // 1.6 Calculate Total ROI Earnings (Specific)
        const roiEarnings = await Transaction.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(userId),
                    type: 'ROI',
                    status: 'COMPLETED'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$amountSFT" }
                }
            }
        ]);
        const totalROI = roiEarnings.length > 0 ? roiEarnings[0].total : 0;

        // 1.7 Calculate Total Level Income (Specific)
        const levelEarnings = await Transaction.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(userId),
                    type: 'LEVEL_INCOME',
                    status: 'COMPLETED'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$amountSFT" }
                }
            }
        ]);
        const totalLevelIncome = levelEarnings.length > 0 ? levelEarnings[0].total : 0;

        // 1.8 Calculate Total Matching Income (Specific)
        const matchingEarnings = await Transaction.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(userId),
                    type: 'MATCHING_INCOME',
                    status: 'COMPLETED'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$amountSFT" }
                }
            }
        ]);
        const totalMatchingIncome = matchingEarnings.length > 0 ? matchingEarnings[0].total : 0;

        // 2. Calculate Total Withdrawn (Completed Withdrawals)
        const withdrawals = await Transaction.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(userId),
                    type: 'WITHDRAWAL',
                    status: 'COMPLETED'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$amountSFT" }
                }
            }
        ]);
        const totalWithdrawn = withdrawals.length > 0 ? withdrawals[0].total : 0;

        // 3. Calculate Pending Withdrawals
        const pendingWithdrawals = await Transaction.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(userId),
                    type: 'WITHDRAWAL',
                    status: 'PENDING'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$amountSFT" }
                }
            }
        ]);
        const totalPending = pendingWithdrawals.length > 0 ? pendingWithdrawals[0].total : 0;

        pendingWithdrawals.length > 0 ? pendingWithdrawals[0].total : 0;

        // 4. Calculate Transfers (Funds moved from Income -> Available)
        const transfers = await Transaction.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(userId),
                    type: 'TRANSFER',
                    status: 'COMPLETED'
                }
            },
            {
                $group: {
                    _id: "$sourceType", // Group by source (ROI, REFERRAL, etc.)
                    totalTransferred: { $sum: "$amountSFT" }
                }
            }
        ]);

        // Map transfers to specific sources
        let totalTransferredROI = 0;
        let totalTransferredReferral = 0;
        let totalTransferredLevel = 0;
        let totalTransferredMatching = 0;

        transfers.forEach(t => {
            if (t._id === 'ROI') totalTransferredROI = t.totalTransferred;
            if (t._id === 'REFERRAL') totalTransferredReferral = t.totalTransferred;
            if (t._id === 'LEVEL') totalTransferredLevel = t.totalTransferred;
            if (t._id === 'MATCHING') totalTransferredMatching = t.totalTransferred;
        });

        // 5. Available to Transfer (Income - Transferred)
        const availableToTransferROI = Math.max(0, totalROI - totalTransferredROI);
        const availableToTransferReferral = Math.max(0, totalReferralEarnings - totalTransferredReferral);
        const availableToTransferLevel = Math.max(0, totalLevelIncome - totalTransferredLevel);
        const availableToTransferMatching = Math.max(0, totalMatchingIncome - totalTransferredMatching);

        // 6. Available Balance (Total Transferred - Total Withdrawn - Pending Withdrawals)
        const totalTransferredAll = totalTransferredROI + totalTransferredReferral + totalTransferredLevel + totalTransferredMatching;
        const availableBalance = Math.max(0, totalTransferredAll - totalWithdrawn - totalPending);

        res.json({
            totalEarned: totalIncome - totalWithdrawn, // Net Balance (for display if needed)
            totalIncome, // Gross Lifetime Earnings

            // Per Source Stats
            totalROI,
            availableToTransferROI,

            totalReferralEarnings,
            availableToTransferReferral,

            totalLevelIncome,
            availableToTransferLevel,

            totalMatchingIncome,
            availableToTransferMatching,

            // Withdraw / Wallet Stats
            totalWithdrawn,
            totalPending,
            availableBalance,

            // [NEW] Income Cap Stats
            maxIncomeLimit: currentUser?.maxIncomeLimit || 0,
            totalEarnedIncome: currentUser?.totalEarnedIncome || 0,
            remainingIncomeLimit: Math.max(0, (currentUser?.maxIncomeLimit || 0) - (currentUser?.totalEarnedIncome || 0))
        });

    } catch (error: any) {
        console.error("Error fetching earnings summary:", error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Admin User Earnings Summary
// @route   GET /api/earnings/admin/summary/:userId
// @access  Private/Admin
export const getAdminUserEarningsSummary = async (req: Request, res: Response) => {
    try {
        // Express 5 types params as `string | string[]` to allow for wildcard routes.
        // `:userId` is a named param, so it is always a single string at runtime.
        const userId = req.params.userId as string;
        const currentUser = await User.findById(userId).select('maxIncomeLimit totalEarnedIncome');

        if (!currentUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        // 1. Calculate Total Income (All Income Sources)
        const earnings = await Transaction.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(userId),
                    type: { $in: ['REFERRAL_REWARD', 'MATURITY_PAYOUT', 'ROI', 'LEVEL_INCOME', 'MATCHING_INCOME'] },
                    status: 'COMPLETED'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$amountSFT" }
                }
            }
        ]);
        const totalIncome = earnings.length > 0 ? earnings[0].total : 0;

        // 1.5 Calculate Total Referral Earnings (Specific)
        const referralEarnings = await Transaction.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(userId),
                    type: 'REFERRAL_REWARD',
                    status: 'COMPLETED'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$amountSFT" }
                }
            }
        ]);
        const totalReferralEarnings = referralEarnings.length > 0 ? referralEarnings[0].total : 0;

        // 1.6 Calculate Total ROI Earnings (Specific)
        const roiEarnings = await Transaction.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(userId),
                    type: 'ROI',
                    status: 'COMPLETED'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$amountSFT" }
                }
            }
        ]);
        const totalROI = roiEarnings.length > 0 ? roiEarnings[0].total : 0;

        // 1.7 Calculate Total Level Income (Specific)
        const levelEarnings = await Transaction.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(userId),
                    type: 'LEVEL_INCOME',
                    status: 'COMPLETED'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$amountSFT" }
                }
            }
        ]);
        const totalLevelIncome = levelEarnings.length > 0 ? levelEarnings[0].total : 0;

        // 1.8 Calculate Total Matching Income (Specific)
        const matchingEarnings = await Transaction.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(userId),
                    type: 'MATCHING_INCOME',
                    status: 'COMPLETED'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$amountSFT" }
                }
            }
        ]);
        const totalMatchingIncome = matchingEarnings.length > 0 ? matchingEarnings[0].total : 0;

        // 2. Calculate Total Withdrawn (Completed Withdrawals)
        const withdrawals = await Transaction.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(userId),
                    type: 'WITHDRAWAL',
                    status: 'COMPLETED'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$amountSFT" }
                }
            }
        ]);
        const totalWithdrawn = withdrawals.length > 0 ? withdrawals[0].total : 0;

        // 3. Calculate Pending Withdrawals
        const pendingWithdrawals = await Transaction.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(userId),
                    type: 'WITHDRAWAL',
                    status: 'PENDING'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$amountSFT" }
                }
            }
        ]);
        const totalPending = pendingWithdrawals.length > 0 ? pendingWithdrawals[0].total : 0;

        // 4. Calculate Transfers (Funds moved from Income -> Available)
        const transfers = await Transaction.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(userId),
                    type: 'TRANSFER',
                    status: 'COMPLETED'
                }
            },
            {
                $group: {
                    _id: "$sourceType", // Group by source (ROI, REFERRAL, etc.)
                    totalTransferred: { $sum: "$amountSFT" }
                }
            }
        ]);

        // Map transfers to specific sources
        let totalTransferredROI = 0;
        let totalTransferredReferral = 0;
        let totalTransferredLevel = 0;
        let totalTransferredMatching = 0;

        transfers.forEach(t => {
            if (t._id === 'ROI') totalTransferredROI = t.totalTransferred;
            if (t._id === 'REFERRAL') totalTransferredReferral = t.totalTransferred;
            if (t._id === 'LEVEL') totalTransferredLevel = t.totalTransferred;
            if (t._id === 'MATCHING') totalTransferredMatching = t.totalTransferred;
        });

        // 5. Available to Transfer (Income - Transferred)
        const availableToTransferROI = Math.max(0, totalROI - totalTransferredROI);
        const availableToTransferReferral = Math.max(0, totalReferralEarnings - totalTransferredReferral);
        const availableToTransferLevel = Math.max(0, totalLevelIncome - totalTransferredLevel);
        const availableToTransferMatching = Math.max(0, totalMatchingIncome - totalTransferredMatching);

        // 6. Available Balance (Total Transferred - Total Withdrawn - Pending Withdrawals)
        const totalTransferredAll = totalTransferredROI + totalTransferredReferral + totalTransferredLevel + totalTransferredMatching;
        const availableBalance = Math.max(0, totalTransferredAll - totalWithdrawn - totalPending);

        res.json({
            totalEarned: totalIncome - totalWithdrawn, // Net Balance (for display if needed)
            totalIncome, // Gross Lifetime Earnings

            // Per Source Stats
            totalROI,
            availableToTransferROI,

            totalReferralEarnings,
            availableToTransferReferral,

            totalLevelIncome,
            availableToTransferLevel,

            totalMatchingIncome,
            availableToTransferMatching,

            // Withdraw / Wallet Stats
            totalWithdrawn,
            totalPending,
            availableBalance,

            // [NEW] Income Cap Stats
            maxIncomeLimit: currentUser?.maxIncomeLimit || 0,
            totalEarnedIncome: currentUser?.totalEarnedIncome || 0,
            remainingIncomeLimit: Math.max(0, (currentUser?.maxIncomeLimit || 0) - (currentUser?.totalEarnedIncome || 0))
        });

    } catch (error: any) {
        console.error("Error fetching admin user earnings:", error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Earnings History
// @route   GET /api/earnings/history
// @access  Private
// @desc    Get Earnings History
// @route   GET /api/earnings/history
// @access  Private
// @desc    Get Earnings History
// @route   GET /api/earnings/history
// @access  Private
export const getEarningsHistory = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user._id;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;
        const typeFilter = req.query.type as string;

        let query: any = {
            user: userId,
            type: { $in: ['REFERRAL_REWARD', 'MATURITY_PAYOUT', 'ROI', 'WITHDRAWAL', 'LEVEL_INCOME', 'MATCHING_INCOME', 'TRANSFER'] }
        };

        if (typeFilter) {
            query.type = typeFilter;
        }

        const total = await Transaction.countDocuments(query);
        const pages = Math.ceil(total / limit);

        const transactions = await Transaction.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json({
            transactions,
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

// @desc    Transfer Earnings to Available Wallet
// @route   POST /api/earnings/transfer
// @access  Private
export const transferToAvailable = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user._id;
        const { amount, sourceType } = req.body; // sourceType: 'ROI', 'REFERRAL', 'LEVEL', 'MATCHING'

        if (!amount || amount <= 0) {
            return res.status(400).json({ message: "Invalid amount" });
        }
        if (!['ROI', 'REFERRAL', 'LEVEL', 'MATCHING'].includes(sourceType)) {
            return res.status(400).json({ message: "Invalid source type" });
        }

        // 1. Calculate Total Income for specific source
        let typeQuery = '';
        if (sourceType === 'ROI') typeQuery = 'ROI';
        else if (sourceType === 'REFERRAL') typeQuery = 'REFERRAL_REWARD'; // Note: Stored as REFERRAL_REWARD
        else if (sourceType === 'LEVEL') typeQuery = 'LEVEL_INCOME';
        else if (sourceType === 'MATCHING') typeQuery = 'MATCHING_INCOME';

        const income = await Transaction.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(userId),
                    type: typeQuery,
                    status: 'COMPLETED'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$amountSFT" }
                }
            }
        ]);
        const totalIncome = income.length > 0 ? income[0].total : 0;

        // 2. Calculate Already Transferred from this source
        const transferred = await Transaction.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(userId),
                    type: 'TRANSFER',
                    sourceType: sourceType,
                    status: 'COMPLETED'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$amountSFT" }
                }
            }
        ]);
        const totalTransferred = transferred.length > 0 ? transferred[0].total : 0;

        // 3. Check Balance
        const availableToTransfer = totalIncome - totalTransferred;

        if (amount > availableToTransfer) {
            return res.status(400).json({
                message: `Insufficient balance in ${sourceType}. Available to transfer: ${availableToTransfer}`
            });
        }

        // 4. Create Transfer Transaction
        const transfer = await Transaction.create({
            user: userId,
            type: 'TRANSFER',
            sourceType: sourceType,
            amountSFT: amount,
            status: 'COMPLETED' // Instant transfer
        });

        await logAudit({
            userId: userId,
            action: 'TRANSFER_EARNINGS',
            details: `User transferred ${amount} SFT from ${sourceType} to Available Balance`,
            resourceType: 'Transaction',
            resourceId: transfer._id.toString(),
            ipAddress: req.ip,
            changes: { amount, sourceType }
        });

        await notifyUser(userId, 'Transfer Successful', `You successfully transferred ${amount} SFT from ${sourceType} to Available Balance.`);

        res.json(transfer);

    } catch (error: any) {
        console.error("Error transferring earnings:", error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Withdraw Earnings
// @route   POST /api/earnings/withdraw
// @access  Private
export const withdrawEarnings = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user._id;
        const { amount, walletAddress } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ message: "Invalid amount" });
        }

        // [NEW] Enforce Email Verification for Withdrawals
        if (!(req as any).user.isEmailVerified) {
            return res.status(403).json({ message: 'Email verification required before withdrawal.' });
        }

        // 1. Calculate Available Balance (Available = Transferred - Withdrawn - Pending)

        // A. Total Transferred (Funds moved from ROI/Referral -> Available)
        const transfers = await Transaction.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(userId),
                    type: 'TRANSFER',
                    status: 'COMPLETED'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$amountSFT" }
                }
            }
        ]);
        const totalTransferred = transfers.length > 0 ? transfers[0].total : 0;

        // B. Total Used (Withdrawn + Pending Withdrawals)
        const withdrawals = await Transaction.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(userId),
                    type: 'WITHDRAWAL',
                    status: { $in: ['COMPLETED', 'PENDING'] }
                }
            },
            { $group: { _id: null, total: { $sum: "$amountSFT" } } }
        ]);
        const totalUsed = withdrawals.length > 0 ? withdrawals[0].total : 0;

        // C. Net Available
        const availableBalance = Math.max(0, totalTransferred - totalUsed);

        if (amount > availableBalance) {
            return res.status(400).json({ message: "Insufficient balance in Available Wallet. Please transfer funds from income sources first." });
        }

        // [NEW] Check Withdrawal Cap
        const capResult = await canWithdraw(userId, amount);
        if (!capResult.allowed) {
            return res.status(400).json({ message: capResult.message });
        }

        // 1.5 Get Withdrawal Settings
        const settings = await IncomeSettings.findOne();
        const minWithdrawal = settings?.minWithdrawal || 0;
        const withdrawalFeePercent = settings?.withdrawalFee || 0;

        if (amount < minWithdrawal) {
            return res.status(400).json({ message: `Minimum withdrawal amount is ${minWithdrawal} SFT` });
        }

        // 2. Calculate Fee
        const fee = (amount * withdrawalFeePercent) / 100;
        const netAmount = amount - fee;

        // 3. Create Withdrawal Transaction
        const withdrawal = await Transaction.create({
            user: userId,
            type: 'WITHDRAWAL',
            amountSFT: amount, // Gross amount requested
            amountSFTAllocated: netAmount, // Net amount to send
            fee: fee,
            status: 'PENDING',
            txHash: undefined // Will be filled by admin upon processing
        });

        await logAudit({
            userId: userId,
            action: 'REQUEST_WITHDRAWAL',
            details: `User requested withdrawal of ${amount} SFT (Net: ${netAmount}) to ${walletAddress || 'Default Wallet'}`,
            resourceType: 'Transaction',
            resourceId: withdrawal._id.toString(),
            ipAddress: req.ip,
            changes: { amount, netAmount, fee, walletAddress }
        });

        await notifyUser(userId, 'Withdrawal Requested', `Your withdrawal request for ${amount} SFT has been submitted.`);

        // Notify Admins
        await notifyAdmins('New Profit Withdrawal', `User requested profit withdrawal of ${amount} SFT (Net: ${netAmount}).`, 'WARNING');

        res.json(withdrawal);

    } catch (error: any) {
        console.error("Error withdrawing earnings:", error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get All Withdrawals (Admin)
// @route   GET /api/earnings/admin/withdrawals
// @access  Private/Admin
export const getAllWithdrawals = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const search = req.query.search as string; // Search query
        const skip = (page - 1) * limit;

        let query: any = { type: 'WITHDRAWAL' };

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
            query.user = { $in: userIds };
        }

        const total = await Transaction.countDocuments(query);
        const pages = Math.ceil(total / limit);

        const withdrawals = await Transaction.find(query)
            .populate('user', 'username email walletAddress')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json({
            withdrawals,
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

// @desc    Approve Withdrawal (Admin)
// @route   PUT /api/earnings/withdrawals/:id/approve
// @access  Private/Admin
export const approveWithdrawal = async (req: Request, res: Response) => {
    try {
        const withdrawal = await Transaction.findById(req.params.id);
        if (!withdrawal) {
            return res.status(404).json({ message: 'Withdrawal not found' });
        }
        if (withdrawal.status !== 'PENDING') {
            return res.status(400).json({ message: `Cannot approve withdrawal with status ${withdrawal.status}` });
        }
        withdrawal.status = 'APPROVED';
        await withdrawal.save();

        await logAudit({
            userId: (req as any).user._id,
            action: 'APPROVE_WITHDRAWAL',
            details: `Admin approved withdrawal ${withdrawal._id}`,
            resourceType: 'Transaction',
            resourceId: withdrawal._id.toString(),
            ipAddress: req.ip,
            changes: { status: { old: 'PENDING', new: 'APPROVED' } }
        });

        await notifyUser(withdrawal.user.toString(), 'Withdrawal Approved', `Your earnings withdrawal request has been approved.`);

        res.json(withdrawal);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Complete Withdrawal (Admin)
// @route   PUT /api/earnings/withdrawals/:id/complete
// @access  Private/Admin
export const completeWithdrawal = async (req: Request, res: Response) => {
    const { txHash } = req.body;
    try {
        const withdrawal = await Transaction.findById(req.params.id);
        if (!withdrawal) {
            return res.status(404).json({ message: 'Withdrawal not found' });
        }
        // Allow completing from PENDING or APPROVED
        if (withdrawal.status !== 'PENDING' && withdrawal.status !== 'APPROVED') {
            return res.status(400).json({ message: `Cannot complete withdrawal with status ${withdrawal.status}` });
        }

        if (txHash && !(await isTxHashUnique(txHash))) {
            return res.status(400).json({ message: 'Transaction hash already used.' });
        }

        withdrawal.status = 'COMPLETED';
        if (txHash) withdrawal.txHash = txHash;
        await withdrawal.save();

        // [NEW] Update User's Total Withdrawn amount (Using Gross Amount)
        await User.findByIdAndUpdate(withdrawal.user, {
            $inc: { totalWithdrawn: withdrawal.amountSFT }
        });

        await logAudit({
            userId: (req as any).user._id,
            action: 'COMPLETE_WITHDRAWAL',
            details: `Admin completed withdrawal ${withdrawal._id}`,
            resourceType: 'Transaction',
            resourceId: withdrawal._id.toString(),
            ipAddress: req.ip,
            changes: { status: { old: 'APPROVED', new: 'COMPLETED' }, txHash }
        });

        await notifyUser(withdrawal.user.toString(), 'Withdrawal Completed', `Your earnings withdrawal of ${withdrawal.amountSFTAllocated} SFT has been completed.`);

        res.json(withdrawal);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Reject Withdrawal (Admin)
// @route   PUT /api/earnings/withdrawals/:id/reject
// @access  Private/Admin
export const rejectWithdrawal = async (req: Request, res: Response) => {
    try {
        const withdrawal = await Transaction.findById(req.params.id);
        if (!withdrawal) {
            return res.status(404).json({ message: 'Withdrawal not found' });
        }
        if (withdrawal.status !== 'PENDING') {
            return res.status(400).json({ message: `Cannot reject withdrawal with status ${withdrawal.status}` });
        }
        withdrawal.status = 'REJECTED';
        await withdrawal.save();

        await logAudit({
            userId: (req as any).user._id,
            action: 'REJECT_WITHDRAWAL',
            details: `Admin rejected withdrawal ${withdrawal._id}`,
            resourceType: 'Transaction',
            resourceId: withdrawal._id.toString(),
            ipAddress: req.ip,
            changes: { status: { old: 'PENDING', new: 'REJECTED' } }
        });

        await notifyUser(withdrawal.user.toString(), 'Withdrawal Rejected', `Your earnings withdrawal request was rejected.`);

        res.json(withdrawal);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
