import mongoose from 'mongoose';
import dotenv from 'dotenv';
import InvestmentPlan from '../models/InvestmentPlan';

dotenv.config();

/**
 * Dumps the configured investment plans, including the payout wallet bound to each plan.
 *
 * Usage: npx tsx src/scripts/check_plans.ts
 */
const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI as string);
        const plans = await InvestmentPlan.find({});
        console.log('Plans:', JSON.stringify(plans, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
};

run();
