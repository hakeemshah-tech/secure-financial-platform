import express from 'express';
import { protect, admin } from '../middlewares/authMiddleware';
import {
    getPendingReferrals, getReferralTree, distributeReferralIncome,
    updatePlacementPreference,
    getPlacementPreference,
    getReferralEarnings,
    getAdminReferralTree,
    getReferralTreeDepth
} from '../controllers/referralController';

const router = express.Router();

router.route('/pending').get(protect, getPendingReferrals);
router.route('/tree').get(protect, getReferralTree);
router.route('/admin/tree/:userId').get(protect, admin, getAdminReferralTree);
router.route('/earnings').get(protect, getReferralEarnings);

router.get('/tree/depth', protect, getReferralTreeDepth);
// Update Placement Preference
router.post('/placement-preference', protect, updatePlacementPreference);

// Get Placement Preference
router.get('/placement-preference', protect, getPlacementPreference);

export default router;
