import { Request, Response } from 'express';
import User from '../models/User';
import Investment from '../models/Investment';
import Transaction from '../models/Transaction';
import Role from '../models/Role';

// Helper to get start of day for chart data
const getStartOfDay = (date: Date) => {
    const newDate = new Date(date);
    newDate.setHours(0, 0, 0, 0);
    return newDate;
};

export const getAdminStats = async (req: Request, res: Response) => {
    try {
        // 1. Card Stats
        const userRole = await Role.findOne({ name: 'user' });
        const totalUsers = userRole ? await User.countDocuments({ role: userRole._id }) : 0;

        const investments = await Investment.aggregate([
            { $match: { status: { $in: ['PAID', 'COMPLETED'] } } },
            { $group: { _id: null, total: { $sum: "$amountSFT" } } }
        ]);
        const totalInvested = investments.length > 0 ? investments[0].total : 0;

        const pendingWithdrawalsCount = await Transaction.countDocuments({
            type: 'WITHDRAWAL',
            status: 'PENDING'
        });

        const completedWithdrawals = await Transaction.aggregate([
            { $match: { type: 'WITHDRAWAL', status: 'APPROVED' } }, // Assuming 'APPROVED' or 'COMPLETED'
            { $group: { _id: null, total: { $sum: "$amountSFT" } } }
        ]);
        const totalWithdrawn = completedWithdrawals.length > 0 ? completedWithdrawals[0].total : 0;


        // 2. Chart Data - Last 7 Days Investments
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const investmentChartData = await Investment.aggregate([
            {
                $match: {
                    createdAt: { $gte: sevenDaysAgo },
                    status: { $in: ['PAID', 'COMPLETED'] }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    amount: { $sum: "$amountSFT" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Fill in missing dates for the last 7 days
        const chartData = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const found = investmentChartData.find(item => item._id === dateStr);
            chartData.push({
                date: dateStr,
                amount: found ? found.amount : 0
            });
        }

        // 3. User Growth / Activity
        const userGrowthMatch: any = { createdAt: { $gte: sevenDaysAgo } };
        if (userRole) {
            userGrowthMatch.role = userRole._id;
        }

        const userGrowthData = await User.aggregate([
            {
                $match: userGrowthMatch
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const userChartData = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const found = userGrowthData.find(item => item._id === dateStr);
            userChartData.push({
                date: dateStr,
                users: found ? found.count : 0
            });
        }


        res.status(200).json({
            stats: {
                totalUsers,
                totalInvested,
                pendingWithdrawalsCount,
                totalWithdrawn
            },
            charts: {
                investments: chartData,
                users: userChartData
            }
        });

    } catch (error) {
        console.error('Error fetching admin dashboard stats:', error);
        res.status(500).json({ message: 'Failed to fetch dashboard statistics' });
    }
};
