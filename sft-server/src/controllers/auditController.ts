import { Request, Response } from 'express';
import AuditLog from '../models/AuditLog';

// @desc    Get all audit logs
// @route   GET /api/audit-logs
// @access  Private/Admin
export const getAuditLogs = async (req: Request, res: Response) => {
    try {
        const pageSize = 20;
        const page = Number(req.query.pageNumber) || 1;
        const keywordParam = req.query.keyword as string;
        const keyword = keywordParam ? {
            $or: [
                { username: { $regex: keywordParam, $options: 'i' } },
                { email: { $regex: keywordParam, $options: 'i' } }
            ]
        } : null;

        let query = {};
        if (keyword) {
            // Find users matching the keyword
            const User = (await import('../models/User')).default;
            const users = await User.find(keyword).select('_id');
            const userIds = users.map(user => user._id);
            query = { user: { $in: userIds } };
        }

        const count = await AuditLog.countDocuments(query);
        const logs = await AuditLog.find(query)
            .populate('user', 'username email role') // Populate user details
            .sort({ createdAt: -1 })
            .limit(pageSize)
            .skip(pageSize * (page - 1));

        res.json({
            logs,
            page,
            pages: Math.ceil(count / pageSize),
            total: count
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching audit logs' });
    }
};
