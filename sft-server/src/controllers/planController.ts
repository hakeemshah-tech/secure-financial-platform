import { Request, Response } from 'express';
import InvestmentPlan from '../models/InvestmentPlan';
import Investment from '../models/Investment';
import { logAudit } from '../utils/auditLogger';

// @desc    Get all active plans
// @route   GET /api/plans
// @access  Public
export const getPlans = async (req: Request, res: Response) => {
    try {
        const { includeDeleted } = req.query;

        // Base match: isActive is true (or remove this if we want inactive too, but usually isActive means "published")
        // The user requirement is about "Soft Deleted" plans.
        // Assuming "isActive" is distinct from "isDeleted" (isActive might be draft/published, isDeleted is trash).
        // Let's stick to the previous logic but allow isDeleted if requested.

        const matchStage: any = { isActive: true };

        if (includeDeleted !== 'true') {
            matchStage.isDeleted = { $ne: true };
        }
        // If includeDeleted === 'true', we simply DON'T add the isDeleted filter, so we get both.

        const plans = await InvestmentPlan.aggregate([
            {
                $match: matchStage
            },
            {
                $lookup: {
                    from: 'investments',
                    localField: '_id',
                    foreignField: 'plan',
                    as: 'investments'
                }
            },
            {
                $addFields: {
                    investmentCount: { $size: '$investments' },
                    hasInvestments: { $gt: [{ $size: '$investments' }, 0] }
                }
            },
            {
                $project: {
                    investments: 0 // Remove the heavy investments array
                }
            },
            ...(req.query.limit ? [{ $limit: parseInt(req.query.limit as string) }] : [])
        ]);

        res.status(200).json(plans);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a plan
// @route   POST /api/plans
// @access  Private/Admin
export const createPlan = async (req: Request, res: Response) => {
    try {
        const plan = new InvestmentPlan(req.body);
        await plan.save();

        await logAudit({
            userId: (req as any).user._id,
            action: 'CREATE_PLAN',
            details: `Created new plan: ${plan.name}`,
            resourceType: 'InvestmentPlan',
            resourceId: plan._id.toString(),
            ipAddress: req.ip,
            changes: req.body
        });

        res.status(201).json(plan);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update a plan
// @route   PUT /api/plans/:id
// @access  Private/Admin
export const updatePlan = async (req: Request, res: Response) => {
    try {
        const planId = req.params.id;

        // Check for existing investments
        const investmentCount = await Investment.countDocuments({ plan: planId });

        if (investmentCount > 0) {
            return res.status(403).json({
                message: 'Cannot edit this plan because users have already invested in it.'
            });
        }

        const plan = await InvestmentPlan.findById(planId);
        if (!plan) {
            return res.status(404).json({ message: 'Plan not found' });
        }

        const updatedPlan = await InvestmentPlan.findByIdAndUpdate(planId, req.body, { new: true });

        await logAudit({
            userId: (req as any).user._id,
            action: 'UPDATE_PLAN',
            details: `Updated plan: ${plan.name}`,
            resourceType: 'InvestmentPlan',
            resourceId: plan._id.toString(),
            ipAddress: req.ip,
            changes: {
                ...Object.keys(req.body).reduce((acc, key) => ({ ...acc, [key]: { old: (plan as any)[key], new: req.body[key] } }), {})
            }
        });

        res.json(updatedPlan);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete (Soft or Hard) a plan
// @route   DELETE /api/plans/:id
// @access  Private/Admin
export const deletePlan = async (req: Request, res: Response) => {
    try {
        const planId = req.params.id;
        const plan = await InvestmentPlan.findById(planId);

        if (!plan) {
            return res.status(404).json({ message: 'Plan not found' });
        }

        // Check if anyone invested
        const investmentCount = await Investment.countDocuments({ plan: planId });

        if (investmentCount > 0) {
            // Soft delete
            plan.isDeleted = true;
            await plan.save();

            await logAudit({
                userId: (req as any).user._id,
                action: 'DELETE_PLAN',
                details: `Soft deleted plan: ${plan.name} (Investments exist)`,
                resourceType: 'InvestmentPlan',
                resourceId: plan._id.toString(),
                ipAddress: req.ip,
                changes: { isDeleted: { old: false, new: true } }
            });

            res.json({ message: 'Plan temporarily deleted (Soft Delete)', type: 'soft' });
        } else {
            // Hard delete
            await InvestmentPlan.findByIdAndDelete(planId);

            await logAudit({
                userId: (req as any).user._id,
                action: 'DELETE_PLAN',
                details: `Permanently deleted plan: ${plan.name}`,
                resourceType: 'InvestmentPlan',
                resourceId: plan._id.toString(),
                ipAddress: req.ip
            });

            res.json({ message: 'Plan permanently deleted', type: 'hard' });
        }

    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
