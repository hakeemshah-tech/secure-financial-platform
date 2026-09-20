import { Request, Response } from 'express';
import SystemConfig from '../models/SystemConfig';
import IncomeSettings from '../models/IncomeSettings';
import { logAudit } from '../utils/auditLogger';

// @desc    Get system settings
// @route   GET /api/settings
// @access  Public
export const getSettings = async (req: Request, res: Response) => {
    try {
        const configs = await SystemConfig.find({});
        const settings: any = {};
        configs.forEach(conf => {
            settings[conf.key] = conf.value;
        });
        res.json(settings);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update active network
// @route   PUT /api/settings/network
// @access  Private/Admin
export const updateActiveNetwork = async (req: Request, res: Response) => {
    try {
        const { chainId, chainName, rpcUrls, nativeCurrency, blockExplorerUrls, adminWallet } = req.body;

        if (!chainId || !chainName || !rpcUrls) {
            return res.status(400).json({ message: 'Missing network parameters' });
        }

        const networkConfig = {
            chainId,
            chainName,
            rpcUrls,
            nativeCurrency,
            blockExplorerUrls,
            adminWallet
        };

        const config = await SystemConfig.findOneAndUpdate(
            { key: 'active_network' },
            { value: networkConfig },
            { new: true, upsert: true }
        );

        res.json(config);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get income settings
// @route   GET /api/settings/income
// @access  Public
export const getIncomeSettings = async (req: Request, res: Response) => {
    try {
        const settings = await IncomeSettings.findOne();
        if (settings) {
            res.json(settings);
        } else {
            // Default values if not set
            res.json({
                referralIncome: 0,
                matchingIncome: 0,
                levelIncome: [],
                minWithdrawal: 0,
                withdrawalFee: 0,
                maxIncomeMultiplier: 0
            });
        }
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update referral income
// @route   PUT /api/settings/income/referral
// @access  Private/Admin
export const updateReferralIncome = async (req: Request, res: Response) => {
    try {
        const { referralIncome } = req.body;
        const toUpdate = Number(referralIncome);
        const oldSettings = await IncomeSettings.findOne(); // [NEW] Fetch old
        const settings = await IncomeSettings.findOneAndUpdate(
            {},
            { referralIncome: toUpdate },
            { new: true, upsert: true }
        );

        await logAudit({
            userId: (req as any).user._id,
            action: 'UPDATE_REFERRAL_INCOME',
            details: `Referral income updated to ${referralIncome}`,
            resourceType: 'IncomeSettings',
            ipAddress: req.ip,
            changes: { referralIncome: { old: oldSettings?.referralIncome, new: toUpdate } } // [FIX] Structure
        });

        res.json(settings);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update matching income
// @route   PUT /api/settings/income/matching
// @access  Private/Admin
export const updateMatchingIncome = async (req: Request, res: Response) => {
    try {
        const { matchingIncome } = req.body;
        const toUpdate = Number(matchingIncome);
        const oldSettings = await IncomeSettings.findOne(); // [NEW] Fetch old
        const settings = await IncomeSettings.findOneAndUpdate(
            {},
            { matchingIncome: toUpdate },
            { new: true, upsert: true }
        );

        await logAudit({
            userId: (req as any).user._id,
            action: 'UPDATE_MATCHING_INCOME',
            details: `Matching income updated to ${matchingIncome}`,
            resourceType: 'IncomeSettings',
            ipAddress: req.ip,
            changes: { matchingIncome: { old: oldSettings?.matchingIncome, new: toUpdate } } // [FIX] Structure
        });

        res.json(settings);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update level income
// @route   PUT /api/settings/income/level
// @access  Private/Admin
export const updateLevelIncome = async (req: Request, res: Response) => {
    try {
        const { levelIncome } = req.body;
        const toUpdate = Array.isArray(levelIncome) ? levelIncome.map(Number) : [];
        const oldSettings = await IncomeSettings.findOne(); // [NEW] Fetch old
        const settings = await IncomeSettings.findOneAndUpdate(
            {},
            { levelIncome: toUpdate },
            { new: true, upsert: true }
        );

        await logAudit({
            userId: (req as any).user._id,
            action: 'UPDATE_LEVEL_INCOME',
            details: `Level income structure updated`,
            resourceType: 'IncomeSettings',
            ipAddress: req.ip,
            changes: { levelIncome: { old: oldSettings?.levelIncome, new: toUpdate } } // [FIX] Structure
        });

        res.json(settings);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update income settings (Legacy/Global)
// @route   PUT /api/settings/income
// @access  Private/Admin
export const updateIncomeSettings = async (req: Request, res: Response) => {
    try {
        const { referralIncome, matchingIncome, levelIncome } = req.body;

        const settings = await IncomeSettings.findOneAndUpdate(
            {},
            {
                referralIncome: Number(referralIncome),
                matchingIncome: Number(matchingIncome),
                levelIncome: Array.isArray(levelIncome) ? levelIncome.map(Number) : []
            },
            { new: true, upsert: true }
        );

        res.json(settings);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update withdrawal settings
// @route   PUT /api/settings/income/withdrawal
// @access  Private/Admin
export const updateWithdrawalSettings = async (req: Request, res: Response) => {
    try {
        const { minWithdrawal, withdrawalFee, maxIncomeMultiplier } = req.body;
        const newMin = Number(minWithdrawal);
        const newFee = Number(withdrawalFee);
        const newMultiplier = Number(maxIncomeMultiplier);
        const oldSettings = await IncomeSettings.findOne();

        const settings = await IncomeSettings.findOneAndUpdate(
            {},
            {
                minWithdrawal: newMin,
                withdrawalFee: newFee,
                maxIncomeMultiplier: newMultiplier
            },
            { new: true, upsert: true }
        );

        await logAudit({
            userId: (req as any).user._id,
            action: 'UPDATE_WITHDRAWAL_SETTINGS',
            details: `Withdrawal settings updated: Min ${minWithdrawal}, Fee ${withdrawalFee}%, Limit ${maxIncomeMultiplier}x`,
            resourceType: 'IncomeSettings',
            ipAddress: req.ip,
            changes: {
                minWithdrawal: { old: oldSettings?.minWithdrawal, new: newMin },
                withdrawalFee: { old: oldSettings?.withdrawalFee, new: newFee },
                maxIncomeMultiplier: { old: oldSettings?.maxIncomeMultiplier, new: newMultiplier }
            }
        });

        res.json(settings);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

