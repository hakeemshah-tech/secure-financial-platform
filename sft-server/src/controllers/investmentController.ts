import { Request, Response } from 'express';
import Investment from '../models/Investment';
import InvestmentPlan from '../models/InvestmentPlan';
import Transaction from '../models/Transaction';
import User from '../models/User';
import { placeUserInTree, distributeReferralIncome, distributeLevelIncome, updateBinaryVolumes } from './referralController';
import { logAudit } from '../utils/auditLogger';
import { notifyUser, notifyAdmins } from './notificationController';
import { isTxHashUnique } from '../services/validationService';
import { increaseUserIncomeLimit } from '../services/incomeService';

// @desc    Create new investment
// @route   POST /api/investments
// @access  Private
export const createInvestment = async (req: Request, res: Response) => {
    const { planId, amount, walletAddress, txHash } = req.body;
    const userId = (req as any).user._id;

    console.log('📝 Creating purchase request:', { userId, planId, amount, walletAddress, txHash });
    console.log('🔍 Full Request Body:', req.body); // Debug log

    try {
        // 0. Validate uniqueness of txHash if provided
        if (txHash && !(await isTxHashUnique(txHash))) {
            return res.status(400).json({ message: 'Transaction hash already used.' });
        }

        // 1. Validate Plan
        const plan = await InvestmentPlan.findById(planId);
        if (!plan) {
            return res.status(404).json({ message: 'Plan not found' });
        }

        // 1.5. Resolve Wallet Address
        let finalWalletAddress = walletAddress;
        if (!finalWalletAddress) {
            // Fallback: Fetch user's registered wallet address
            const user = await User.findById(userId);
            if (user && user.walletAddress) {
                finalWalletAddress = user.walletAddress;
            } else {
                return res.status(400).json({ message: 'No wallet address found. Please update your profile or connect wallet.' });
            }
        }

        if (amount < plan.minInvestmentSFT) {
            return res.status(400).json({ message: `Minimum investment is ${plan.minInvestmentSFT} SFT` });
        }

        // 2. Calculate SFT Allocation (Including ROI)
        // Treat input amount as SFT units directly
        const baseSft = amount;
        const roiAmount = baseSft * (plan.roiPercent / 100);
        const sftAllocated = baseSft + roiAmount;

        // 3. Calculate Maturity Date
        const maturityDate = new Date();
        maturityDate.setDate(maturityDate.getDate() + plan.lockInPeriodDays);

        // 4. Create Investment Request (PENDING - no payment yet)
        const investment = await Investment.create({
            user: userId,
            plan: planId,
            walletAddress: finalWalletAddress,
            amountSFT: amount,
            sftAllocated,
            startDate: new Date(),
            maturityDate,
            status: 'PENDING',
            txHash: txHash || undefined // optional txHash
        });

        // 5. Create Transaction Log (PENDING)
        await Transaction.create({
            user: userId,
            plan: planId,
            investment: investment._id,
            type: 'PURCHASE',
            amountSFT: amount,
            amountSFTAllocated: sftAllocated,
            status: 'PENDING',
            txHash: txHash || undefined // Persist txHash to Transaction log too
        });

        await logAudit({
            userId: userId,
            action: 'CREATE_INVESTMENT',
            details: `User created investment request of ${amount} SFT`,
            resourceType: 'Investment',
            resourceId: investment._id.toString(),
            ipAddress: req.ip,
            changes: { planId, amount, walletAddress: finalWalletAddress }
        });

        console.log('✅ Purchase request created successfully:', investment._id);

        // Notify User
        await notifyUser(userId, 'Investment Submitted', `Your investment of ${amount} SFT has been created.`);

        // Notify Admins
        await notifyAdmins('New Investment Request', `User has requested to invest ${amount} SFT (Plan ID: ${planId}).`, 'INFO');

        res.status(201).json(investment);

    } catch (error: any) {
        console.error('❌ Error creating purchase request:', error);
        res.status(500).json({ message: error.message || 'Server error', stack: process.env.NODE_ENV === 'development' ? error.stack : undefined });
    }
};

// @desc    Admin Create Investment (Activate Plan for User)
// @route   POST /api/investments/admin/add
// @access  Private/Admin
export const adminCreateInvestment = async (req: Request, res: Response) => {
    const { userId, planIds } = req.body;
    // planIds is expected to be an array of plan IDs

    console.log('📝 Admin creating investment for user:', { userId, planIds });

    try {
        if (!userId || !planIds || !Array.isArray(planIds) || planIds.length === 0) {
            return res.status(400).json({ message: 'User ID and at least one Plan ID are required.' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const createdInvestments = [];

        for (const planId of planIds) {
            const plan = await InvestmentPlan.findById(planId);
            if (!plan) {
                console.warn(`⚠️ Plan ${planId} not found, skipping.`);
                continue;
            }

            // Calculate amounts
            // For admin creation, we assume standard min investment for now, or check if admin sent specific amount?
            // The requirement says "select single or multiple plan", usually implies purchasing the plan.
            // Plans usually have a fixed price or min amount. 
            // If the plan has a fixed price/sft allocated logic, we use that.
            // Using minInvestmentSFT as the default amount if not specified is a safe bet, 
            // OR we could assume the admin wants to give the standard package.
            // Let's use minInvestmentSFT as the base amount for the plan.

            const amount = plan.minInvestmentSFT;

            // 2. Calculate SFT Allocation (Including ROI)
            const baseSft = amount;
            const roiAmount = baseSft * (plan.roiPercent / 100);
            const sftAllocated = baseSft + roiAmount;

            // 3. Calculate Maturity Date
            const maturityDate = new Date();
            maturityDate.setDate(maturityDate.getDate() + plan.lockInPeriodDays);

            // 4. Create Investment (PAID status directly)
            const investment = await Investment.create({
                user: userId,
                plan: planId,
                walletAddress: user.walletAddress || plan.walletAddress, // Fallback to plan's wallet if user has none, though user should have one.
                amountSFT: amount,
                sftAllocated,
                startDate: new Date(),
                maturityDate,
                status: 'PAID', // Directly PAID
                isVolumeDistributed: false // Will be set to true after distribution
            });

            // 5. Create Transaction Log
            await Transaction.create({
                user: userId,
                plan: planId,
                investment: investment._id,
                type: 'PURCHASE',
                amountSFT: amount,
                amountSFTAllocated: sftAllocated,
                status: 'COMPLETED',
                notes: 'Admin manual activation'
            });

            // 6. Distribute Volumes & Commissions
            console.log(`🚀 Distributing volume for ADMIN created investment ${investment._id}`);
            await placeUserInTree(userId);
            await distributeReferralIncome(investment._id.toString());
            await distributeLevelIncome(investment._id.toString());
            await updateBinaryVolumes(investment._id.toString());

            // Mark distributed
            investment.isVolumeDistributed = true;
            await investment.save();

            // 7. Update User Active Status & Income Limit
            await User.findByIdAndUpdate(userId, { isActive: true });
            await increaseUserIncomeLimit(userId, amount);

            createdInvestments.push(investment);
        }

        await logAudit({
            userId: (req as any).user._id,
            action: 'ADMIN_CREATE_INVESTMENT',
            details: `Admin activated ${createdInvestments.length} plans for user ${userId}`,
            resourceType: 'User',
            resourceId: userId,
            ipAddress: req.ip,
            changes: { planIds }
        });

        // Notify User
        await notifyUser(
            userId,
            'Plan Activated',
            `Admin has activated ${createdInvestments.length} investment plan(s) for your account.`,
            'SUCCESS'
        );

        res.status(201).json({
            message: `Successfully activated ${createdInvestments.length} plans.`,
            investments: createdInvestments
        });

    } catch (error: any) {
        console.error('❌ Error in adminCreateInvestment:', error);
        res.status(500).json({ message: error.message || 'Server error' });
    }
};

// @desc    Get my investments
// @route   GET /api/investments/my
// @access  Private
export const getMyInvestments = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user._id;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        const total = await Investment.countDocuments({ user: userId });
        const pages = Math.ceil(total / limit);

        const investments = await Investment.find({ user: userId })
            .populate('plan')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json({
            investments,
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

// @desc    Get all investments (Admin)
// @route   GET /api/investments/admin
// @access  Private/Admin
export const getAllInvestments = async (req: Request, res: Response) => {
    console.log('🔍 Admin fetching all purchase requests...');
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const search = req.query.search as string; // Search query
        const skip = (page - 1) * limit;

        let query: any = {};

        if (search) {
            // Find users matching search criteria
            const users = await User.find({
                $or: [
                    { username: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                    { phoneNumber: { $regex: search, $options: 'i' } },
                    { walletAddress: { $regex: search, $options: 'i' } }
                ]
            }).select('_id');

            const userIds = users.map(u => u._id);

            // Filter Investments by User IDs OR Investment's specific wallet address
            query = {
                $or: [
                    { user: { $in: userIds } },
                    { walletAddress: { $regex: search, $options: 'i' } }
                ]
            };
        }

        const total = await Investment.countDocuments(query);
        const pages = Math.ceil(total / limit);

        const investments = await Investment.find(query)
            .populate('user', 'username email walletAddress')
            .populate('plan')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        console.log(`✅ Found ${investments.length} purchase requests (Page ${page}/${pages})`);

        res.json({
            investments,
            pagination: {
                page,
                limit,
                pages,
                total
            }
        });
    } catch (error: any) {
        console.error('❌ Error fetching purchase requests:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Approve Investment
// @route   PUT /api/investments/:id/approve
// @access  Private/Admin
export const approveInvestment = async (req: Request, res: Response) => {
    try {
        const investment = await Investment.findById(req.params.id);
        if (!investment) {
            return res.status(404).json({ message: 'Investment not found' });
        }

        if (investment.status !== 'PENDING') {
            return res.status(400).json({
                message: `Cannot approve investment with status ${investment.status}`
            });
        }

        if (investment.txHash) {
            investment.status = 'PAID'; // Changed from COMPLETED to PAID

            // Recalculate dates based on activation time
            const plan = await InvestmentPlan.findById(investment.plan);
            if (plan) {
                investment.startDate = new Date();
                const maturityDate = new Date();
                maturityDate.setDate(maturityDate.getDate() + plan.lockInPeriodDays);
                investment.maturityDate = maturityDate;
            }

            // Update transaction log as well
            await Transaction.findOneAndUpdate(
                { investment: investment._id, type: 'PURCHASE' },
                { status: 'COMPLETED', txHash: investment.txHash }
            );
        } else {
            investment.status = 'APPROVED';
        }

        await investment.save();

        if (investment.status === 'PAID') {
            if (!investment.isVolumeDistributed) {
                console.log(`🚀 Distributing volume for approved investment ${investment._id}`);
                await placeUserInTree(investment.user.toString());
                await distributeReferralIncome(investment._id.toString());
                await distributeLevelIncome(investment._id.toString());
                await updateBinaryVolumes(investment._id.toString());

                investment.isVolumeDistributed = true; // Set flag
                await investment.save();

                // [NEW] Activate User
                await User.findByIdAndUpdate(investment.user, { isActive: true });

                // [NEW] Increase Income Limit
                await increaseUserIncomeLimit(investment.user.toString(), investment.amountSFT);
            } else {
                console.log(`⚠️ Volume ALREADY distributed for investment ${investment._id}. Skipping.`);
            }
        }

        await logAudit({
            userId: (req as any).user._id,
            action: 'APPROVE_INVESTMENT',
            details: `Admin approved investment ${investment._id}, status set to ${investment.status}`,
            resourceType: 'Investment',
            resourceId: investment._id.toString(),
            ipAddress: req.ip,
            changes: { status: { old: 'PENDING', new: investment.status } }
        });

        // Notify User
        await notifyUser(
            investment.user.toString(),
            'Investment Approved',
            `Your investment request #${investment._id} has been approved. Status: ${investment.status}`,
            'SUCCESS'
        );

        res.json(investment);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Reject Investment
// @route   PUT /api/investments/:id/reject
// @access  Private/Admin
export const rejectInvestment = async (req: Request, res: Response) => {
    try {
        const investment = await Investment.findById(req.params.id);
        if (!investment) {
            return res.status(404).json({ message: 'Investment not found' });
        }

        if (investment.status !== 'PENDING') {
            return res.status(400).json({
                message: `Cannot reject investment with status ${investment.status}`
            });
        }

        investment.status = 'REJECTED';
        await investment.save();

        // Update transaction status
        await Transaction.findOneAndUpdate(
            { investment: investment._id, type: 'PURCHASE' },
            { status: 'FAILED' }
        );

        await logAudit({
            userId: (req as any).user._id,
            action: 'REJECT_INVESTMENT',
            details: `Admin rejected investment ${investment._id}`,
            resourceType: 'Investment',
            resourceId: investment._id.toString(),
            ipAddress: req.ip,
            changes: { status: { old: 'PENDING', new: 'REJECTED' } }
        });

        await notifyUser(investment.user.toString(), 'Investment Rejected', `Your investment request #${investment._id} was rejected.`);

        res.json(investment);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Confirm Payment (User submits txHash after paying USDT)
// @route   PUT /api/investments/:id/payment
// @access  Private
export const confirmPayment = async (req: Request, res: Response) => {
    const { txHash } = req.body;
    const userId = (req as any).user._id;

    try {
        const investment = await Investment.findById(req.params.id);
        if (!investment) {
            return res.status(404).json({ message: 'Investment not found' });
        }

        // Validate uniqueness of txHash
        if (txHash && !(await isTxHashUnique(txHash))) {
            return res.status(400).json({ message: 'Transaction hash already used.' });
        }

        // Verify this investment belongs to the user
        if (investment.user.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (investment.status !== 'APPROVED') {
            return res.status(400).json({
                message: `Cannot pay for investment with status ${investment.status}`
            });
        }

        investment.status = 'PAID'; // Changed from COMPLETED to PAID
        investment.txHash = txHash;

        // Recalculate dates based on activation time
        const plan = await InvestmentPlan.findById(investment.plan);
        if (plan) {
            investment.startDate = new Date();
            const maturityDate = new Date();
            maturityDate.setDate(maturityDate.getDate() + plan.lockInPeriodDays);
            investment.maturityDate = maturityDate;
        }

        // [MODIFIED] Check Flag
        if (!investment.isVolumeDistributed) {
            console.log(`🚀 Distributing volume for confirmed payment ${investment._id}`);
            // Place in Tree
            await placeUserInTree(userId.toString());
            await distributeReferralIncome(investment._id.toString());
            await distributeLevelIncome(investment._id.toString());
            await updateBinaryVolumes(investment._id.toString());

            investment.isVolumeDistributed = true; // Set flag

            // [NEW] Activate User
            await User.findByIdAndUpdate(userId, { isActive: true });

            // [NEW] Increase Income Limit
            await increaseUserIncomeLimit(userId.toString(), investment.amountSFT);
        } else {
            console.log(`⚠️ Volume ALREADY distributed for investment ${investment._id}. Skipping.`);
        }

        await investment.save();

        // Update transaction status
        await Transaction.findOneAndUpdate(
            { investment: investment._id, type: 'PURCHASE' },
            { status: 'COMPLETED', txHash }
        );

        // Notify User
        await notifyUser(
            userId.toString(),
            'Payment Confirmed',
            `Your payment for investment #${investment._id} has been confirmed.`,
            'SUCCESS'
        );

        // Notify Admins
        await notifyAdmins('Payment Proof Submitted', `User has submitted proof of payment for Investment #${investment._id}. Please verify and approve.`, 'WARNING');

        res.json(investment);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Complete Investment (Admin confirms Investment Active - NO Transfer yet)
// @route   PUT /api/investments/:id/complete
// @access  Private/Admin
export const completeInvestment = async (req: Request, res: Response) => {
    const { txHash } = req.body;
    try {
        const investment = await Investment.findById(req.params.id);
        if (!investment) {
            return res.status(404).json({ message: 'Investment not found' });
        }

        if (txHash && !(await isTxHashUnique(txHash))) {
            return res.status(400).json({ message: 'Transaction hash already used.' });
        }

        if (investment.status !== 'PAID' && investment.status !== 'COMPLETED') {
            return res.status(400).json({
                message: `Cannot complete investment with status ${investment.status}`
            });
        }

        investment.status = 'PAID'; // Ensure it stays/becomes PAID
        // Note: We do NOT define sftTxHash here anymore as transfer happens at withdrawal

        // [MODIFIED] Check Flag
        if (!investment.isVolumeDistributed) {
            console.log(`🚀 Distributing volume for completed investment ${investment._id}`);
            await placeUserInTree(investment.user.toString());
            await distributeReferralIncome(investment._id.toString());
            await distributeLevelIncome(investment._id.toString());
            await updateBinaryVolumes(investment._id.toString());

            investment.isVolumeDistributed = true;

            // [NEW] Activate User
            await User.findByIdAndUpdate(investment.user, { isActive: true });

            // [NEW] Increase Income Limit
            await increaseUserIncomeLimit(investment.user.toString(), investment.amountSFT);
        } else {
            console.log(`⚠️ Volume ALREADY distributed for investment ${investment._id}. Skipping.`);
        }

        await investment.save();

        // Update original PURCHASE transaction to COMPLETED (if not already)
        await Transaction.findOneAndUpdate(
            { investment: investment._id, type: 'PURCHASE' },
            { status: 'COMPLETED' }
        );

        // Notify User
        await notifyUser(
            investment.user.toString(),
            'Investment Active',
            `Your investment #${investment._id} is now fully ACTIVE.`,
            'SUCCESS'
        );

        res.json(investment);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Cancel Investment
// @route   PUT /api/investments/:id/cancel
// @access  Private/Admin
export const cancelInvestment = async (req: Request, res: Response) => {
    try {
        const investment = await Investment.findById(req.params.id);
        if (!investment) {
            return res.status(404).json({ message: 'Investment not found' });
        }

        if (investment.status !== 'PENDING' && investment.status !== 'APPROVED') {
            return res.status(400).json({
                message: `Cannot cancel investment with status ${investment.status}`
            });
        }

        investment.status = 'CANCELLED';
        await investment.save();

        // Update transaction status if exists
        await Transaction.findOneAndUpdate(
            { investment: investment._id, type: 'PURCHASE' },
            { status: 'CANCELLED' }
        );

        res.json(investment);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get my transactions
// @route   GET /api/investments/transactions
// @access  Private
export const getTransactions = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user._id;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        const total = await Transaction.countDocuments({ user: userId });
        const pages = Math.ceil(total / limit);

        const transactions = await Transaction.find({ user: userId })
            .populate('plan', 'name')
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

// @desc    Get all transactions (Admin)
// @route   GET /api/investments/admin/transactions
// @access  Private/Admin
export const getAllTransactions = async (req: Request, res: Response) => {
    console.log('🔍 Admin fetching ALL system transactions...');
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        const total = await Transaction.countDocuments({});
        const pages = Math.ceil(total / limit);

        const transactions = await Transaction.find({})
            .populate('user', 'username email walletAddress')
            .populate('plan', 'name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        console.log(`✅ Found ${transactions.length} system transactions (Page ${page}/${pages})`);

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
        console.error('❌ Error fetching system transactions', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Cancel My Investment (User)
// @route   PUT /api/investments/:id/cancel-my
// @access  Private
export const cancelMyInvestment = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user._id;
        const investment = await Investment.findById(req.params.id);

        if (!investment) {
            return res.status(404).json({ message: 'Investment not found' });
        }

        // Verify ownership
        if (investment.user.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Not authorized to cancel this investment' });
        }

        if (investment.status !== 'PENDING' && investment.status !== 'APPROVED') {
            return res.status(400).json({
                message: `Cannot cancel investment with status ${investment.status}`
            });
        }

        investment.status = 'CANCELLED';
        await investment.save();

        // Update transaction status if exists
        await Transaction.findOneAndUpdate(
            { investment: investment._id, type: 'PURCHASE' },
            { status: 'CANCELLED' }
        );

        res.json(investment);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Request SFT Withdrawal (User)
// @route   PUT /api/investments/:id/withdraw-request
// @access  Private
export const requestWithdrawal = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user._id;
        const investment = await Investment.findById(req.params.id);

        if (!investment) {
            return res.status(404).json({ message: 'Investment not found' });
        }

        // Verify ownership
        if (investment.user.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        // [NEW] Enforce Email Verification for Withdrawals
        if (!(req as any).user.isEmailVerified) {
            return res.status(403).json({ message: 'Email verification required before withdrawal.' });
        }

        // Allow withdrawal if status is PAID or COMPLETED
        if (investment.status !== 'PAID' && investment.status !== 'COMPLETED') {
            return res.status(400).json({ message: `Cannot request withdrawal for status ${investment.status}` });
        }

        // Check Maturity
        if (new Date() < new Date(investment.maturityDate)) {
            return res.status(400).json({ message: 'Investment is still locked' });
        }

        // 1. Mark original investment as WITHDRAWAL_SUBMITTED
        investment.status = 'WITHDRAWAL_SUBMITTED';
        await investment.save();

        // 2. Create NEW Investment entry for the Withdrawal Request
        const withdrawalRequest = await Investment.create({
            user: userId,
            plan: investment.plan,
            walletAddress: investment.walletAddress,
            amountSFT: 0, // Not a new investment amount
            sftAllocated: investment.amountSFT, // [FIX] Withdraw Principal Only (Profit already paid via ROI)
            startDate: new Date(),
            maturityDate: new Date(), // Immediate
            status: 'WITHDRAW_REQUESTED',
            requestType: 'WITHDRAWAL',
            parentInvestment: investment._id
        });

        // Notify Admins
        await notifyAdmins('New Withdrawal Request', `User has requested a withdrawal for Investment #${investment._id}.`, 'WARNING');

        res.json(withdrawalRequest);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Approve Withdrawal (Admin)
// @route   PUT /api/investments/:id/withdraw-approve
// @access  Private/Admin
export const approveWithdrawal = async (req: Request, res: Response) => {
    try {
        const investment = await Investment.findById(req.params.id);
        if (!investment) {
            return res.status(404).json({ message: 'Investment not found' });
        }

        if (investment.status !== 'WITHDRAW_REQUESTED') {
            return res.status(400).json({ message: `Cannot approve withdrawal for status ${investment.status}` });
        }

        investment.status = 'WITHDRAW_APPROVED';
        await investment.save();

        await logAudit({
            userId: (req as any).user._id,
            action: 'APPROVE_WITHDRAWAL',
            details: `Admin approved principal withdrawal for investment ${investment._id}`,
            resourceType: 'Investment',
            resourceId: investment._id.toString(),
            ipAddress: req.ip,
            changes: { status: { old: 'WITHDRAW_REQUESTED', new: 'WITHDRAW_APPROVED' } }
        });

        // Notify User
        await notifyUser(
            investment.user.toString(),
            'Withdrawal Approved',
            `Your withdrawal request for investment #${investment._id} has been approved.`,
            'SUCCESS'
        );

        res.json(investment);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Complete Withdrawal (Admin - Transfer SFT)
// @route   PUT /api/investments/:id/withdraw-complete
// @access  Private/Admin
export const completeWithdrawal = async (req: Request, res: Response) => {
    const { txHash } = req.body;
    try {
        const investment = await Investment.findById(req.params.id);
        if (!investment) {
            return res.status(404).json({ message: 'Investment not found' });
        }

        if (txHash && !(await isTxHashUnique(txHash))) {
            return res.status(400).json({ message: 'Transaction hash already used.' });
        }

        if (investment.status !== 'WITHDRAW_APPROVED') {
            return res.status(400).json({ message: `Cannot complete withdrawal for status ${investment.status}` });
        }

        investment.status = 'WITHDRAW_COMPLETED';
        if (txHash) {
            investment.sftTxHash = txHash;
        }
        await investment.save();

        // Create transaction log for Withdrawal/Transfer
        await Transaction.create({
            user: investment.user,
            plan: investment.plan,
            investment: investment._id,
            type: 'SFT_TRANSFER',
            amountSFT: 0,
            amountSFTAllocated: investment.sftAllocated,
            status: 'COMPLETED',
            txHash: txHash || undefined
        });

        await logAudit({
            userId: (req as any).user._id,
            action: 'COMPLETE_WITHDRAWAL',
            details: `Admin completed principal withdrawal for investment ${investment._id}`,
            resourceType: 'Investment',
            resourceId: investment._id.toString(),
            ipAddress: req.ip,
            changes: { status: { old: 'WITHDRAW_APPROVED', new: 'WITHDRAW_COMPLETED' }, txHash }
        });

        // Notify User
        await notifyUser(
            investment.user.toString(),
            'Withdrawal Completed',
            `Your withdrawal for investment #${investment._id} has been completed.`,
            'SUCCESS'
        );

        res.json(investment);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Investments by User (Admin)
// @route   GET /api/investments/admin/user/:userId
// @access  Private/Admin
export const getAdminUserInvestments = async (req: Request, res: Response) => {
    try {
        const userId = req.params.userId;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        const total = await Investment.countDocuments({ user: userId });
        const pages = Math.ceil(total / limit);

        const investments = await Investment.find({ user: userId })
            .populate('plan')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json({
            investments,
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

// @desc    Get Transactions by User (Admin)
// @route   GET /api/investments/admin/user/:userId/transactions
// @access  Private/Admin
export const getAdminUserTransactions = async (req: Request, res: Response) => {
    try {
        const userId = req.params.userId;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const type = req.query.type as string; // Support type filtering
        const skip = (page - 1) * limit;

        const query: any = { user: userId };
        if (type) {
            query.type = type;
        }

        const total = await Transaction.countDocuments(query);
        const pages = Math.ceil(total / limit);

        const transactions = await Transaction.find(query)
            .populate('plan', 'name')
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

