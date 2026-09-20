import axios from 'axios';

/**
 * End-to-end contract check for the `walletAddress` field on an investment plan.
 *
 * Confirms that a payout wallet submitted on plan creation is persisted verbatim and
 * returned intact on read, i.e. that the field is not silently stripped by validation,
 * schema casting, or the serializer before it reaches the payment UI.
 *
 * Credentials are read from the environment; nothing is hardcoded. Point this at a
 * development or staging API only.
 *
 *   API_URL=http://localhost:5000/api \
 *   VERIFY_ADMIN_EMAIL=<admin email> \
 *   VERIFY_ADMIN_PASSWORD=<admin password> \
 *   VERIFY_WALLET_ADDRESS=<payout wallet> \
 *   npx tsx scripts/verify_wallet_field.ts
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:5000/api';
const ADMIN_EMAIL = process.env.VERIFY_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.VERIFY_ADMIN_PASSWORD;
const WALLET_ADDRESS = process.env.VERIFY_WALLET_ADDRESS || '0x0000000000000000000000000000000000000000';

async function test() {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
        console.error('Missing VERIFY_ADMIN_EMAIL / VERIFY_ADMIN_PASSWORD in the environment.');
        process.exit(1);
    }

    try {
        console.log('Logging in...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD
        });
        const token = loginRes.data.token;
        console.log('Logged in. Token obtained.');

        console.log('Creating plan with wallet address...');
        const planData = {
            name: 'Verification Plan',
            description: 'Auto verification',
            lockInPeriodDays: 1,
            sftPrice: 0.1,
            minInvestmentSFT: 10,
            roiPercent: 1,
            walletAddress: WALLET_ADDRESS
        };

        const createRes = await axios.post(`${API_URL}/plans`, planData, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Plan created:', createRes.data._id);

        console.log('Fetching plans to verify...');
        const listRes = await axios.get(`${API_URL}/plans`);
        const createdPlan = listRes.data.find((p: any) => p._id === createRes.data._id);

        if (createdPlan && createdPlan.walletAddress === WALLET_ADDRESS) {
            console.log('SUCCESS: Wallet address found in created plan.');
        } else {
            console.error('FAILURE: Wallet address missing or incorrect.', createdPlan);
        }

        console.log('Cleaning up...');
        await axios.delete(`${API_URL}/plans/${createRes.data._id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Cleanup done.');

    } catch (err: any) {
        console.error('Error:', err.response?.data || err.message);
    }
}

test();
