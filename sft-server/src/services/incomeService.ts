import User, { IUser } from '../models/User';
import IncomeSettings from '../models/IncomeSettings';

export const increaseUserIncomeLimit = async (userId: string, investmentAmount: number) => {
    try {
        const settings = await IncomeSettings.findOne();
        const multiplier = settings?.maxIncomeMultiplier || 2; // Default to 2x if not set

        const increaseAmount = investmentAmount * multiplier;

        await User.findByIdAndUpdate(userId, {
            $inc: { maxIncomeLimit: increaseAmount }
        });

        console.log(`User ${userId} income limit increased by ${increaseAmount} (Inv: ${investmentAmount} * ${multiplier})`);
    } catch (error) {
        console.error(`Error increasing income limit for user ${userId}:`, error);
    }
};

export const canWithdraw = async (userId: string, requestedAmount: number) => {
    try {
        const User = require('../models/User').default;
        const Transaction = require('../models/Transaction').default;

        const user = await User.findById(userId);
        if (!user) return { allowed: false, remaining: 0, message: 'User not found' };

        const limit = user.maxIncomeLimit || 0;
        const totalWithdrawnValues = user.totalWithdrawn || 0;

        // Calculate Pending or Approved withdrawals that are not yet in user.totalWithdrawn
        const pendingWithdrawalsGroup = await Transaction.aggregate([
            {
                $match: {
                    user: user._id,
                    type: 'WITHDRAWAL',
                    status: { $in: ['PENDING', 'APPROVED'] }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$amountSFT" } // Gross amount
                }
            }
        ]);
        const pendingWithdrawn = pendingWithdrawalsGroup.length > 0 ? pendingWithdrawalsGroup[0].total : 0;

        const currentTotalUsage = totalWithdrawnValues + pendingWithdrawn;
        const remaining = Math.max(0, limit - currentTotalUsage);

        if (requestedAmount <= remaining) {
            return { allowed: true, remaining: remaining - requestedAmount, message: 'Allowed' };
        } else {
            return {
                allowed: false,
                remaining,
                message: `Withdrawal limit reached. Limit: ${limit}, Used: ${currentTotalUsage} (Completed: ${totalWithdrawnValues}, Pending: ${pendingWithdrawn}), Remaining: ${remaining}`
            };
        }
    } catch (error: any) {
        console.error(`Error checking withdrawal limit for user ${userId}:`, error);
        return { allowed: false, remaining: 0, message: error.message };
    }
};

export const checkAndCapIncome = async (userId: string, amount: number) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            console.error(`User not found: ${userId}`);
            return { amount: 0, isCapped: true };
        }

        const limit = user.maxIncomeLimit || 0;
        const totalEarned = user.totalEarnedIncome || 0;
        const remaining = Math.max(0, limit - totalEarned);

        if (amount <= remaining) {
            return { amount: amount, isCapped: false };
        } else {
            return { amount: remaining, isCapped: true };
        }
    } catch (error) {
        console.error(`Error checking income cap for user ${userId}:`, error);
        return { amount: 0, isCapped: true };
    }
};
