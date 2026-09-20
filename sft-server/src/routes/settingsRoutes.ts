import express from 'express';
import { getSettings, updateActiveNetwork, getIncomeSettings, updateIncomeSettings, updateReferralIncome, updateMatchingIncome, updateLevelIncome, updateWithdrawalSettings } from '../controllers/settingsController';
import { protect, admin } from '../middlewares/authMiddleware';

const router = express.Router();

router.get('/', getSettings);
router.put('/network', protect, admin, updateActiveNetwork);

router.get('/income', protect, getIncomeSettings);
router.put('/income', protect, admin, updateIncomeSettings); // Keep for backward compatibility if needed, or remove later
router.put('/income/referral', protect, admin, updateReferralIncome);
router.put('/income/matching', protect, admin, updateMatchingIncome);
router.put('/income/level', protect, admin, updateLevelIncome);
router.put('/income/withdrawal', protect, admin, updateWithdrawalSettings);

export default router;
