
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(__dirname, '../../server/.env') });

import User from './models/User';
import Investment from './models/Investment';
import Transaction from './models/Transaction';
import IncomeSettings from './models/IncomeSettings';
import Link from './models/InvestmentPlan'; // Just to populate if needed

// We need to import the function. Since it's not exported as a standalone easily usable without app context sometimes, 
// we'll try to use it if the module structure allows. 
// If not, we will replicate the call or use a direct approach.
// Looking at referralController.ts, distributeReferralIncome IS exported.
import { distributeReferralIncome } from './controllers/referralController';

const runVerification = async () => {
    try {
        console.log("🔌 Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI as string);
        console.log("✅ Connected.");

        // 1. Setup Income Settings
        console.log("⚙️ Setting Referral Income to 10%...");
        await IncomeSettings.findOneAndUpdate({}, { referralIncome: 10 }, { upsert: true });

        // 2. Create Users
        const referrerEmail = `referrer_${Date.now()}@test.com`;
        const userEmail = `user_${Date.now()}@test.com`;

        const referrer = await User.create({
            walletAddress: `0xREF${Date.now()}`,
            email: referrerEmail,
            username: `ref_${Date.now()}`,
            role: new mongoose.Types.ObjectId(), // Fake role ID
            referralCode: `REF${Date.now()}`
        });

        const user = await User.create({
            walletAddress: `0xUSER${Date.now()}`,
            email: userEmail,
            username: `u_${Date.now()}`,
            role: new mongoose.Types.ObjectId(),
            referralCode: `USR${Date.now()}`,
            referrer: referrer._id
        });

        console.log(`👤 Created Referrer: ${referrer.email}`);
        console.log(`👤 Created User: ${user.email} (Referrer: ${referrer.email})`);

        // 3. Create Investment
        const investmentAmount = 500;
        const investment = await Investment.create({
            user: user._id,
            plan: new mongoose.Types.ObjectId(), // Fake Plan ID
            walletAddress: user.walletAddress,
            amountSFT: investmentAmount,
            sftAllocated: investmentAmount,
            startDate: new Date(),
            maturityDate: new Date(),
            status: 'PAID'
        });

        console.log(`💰 Created Investment: ${investmentAmount} SFT`);

        // 4. Trigger Distribution
        console.log("🚀 Triggering distributeReferralIncome...");
        await distributeReferralIncome(investment._id.toString());

        // 5. Verify Transaction
        const tx = await Transaction.findOne({
            user: referrer._id,
            type: 'REFERRAL_REWARD',
            investment: investment._id
        });

        if (tx) {
            console.log("✅ Transaction Found!");
            console.log(`   Amount: ${tx.amountSFT} SFT`);

            const expected = investmentAmount * 0.10; // 10% of 500 = 50
            if (tx.amountSFT === expected) {
                console.log(`   🎉 SUCCESS: Amount matches expected 10% (${expected} SFT)`);
            } else {
                console.error(`   ❌ FAILURE: Expected ${expected}, got ${tx.amountSFT}`);
            }
        } else {
            console.error("❌ FAILURE: No Referral Transaction found.");
        }

        // Cleanup
        await User.deleteOne({ _id: referrer._id });
        await User.deleteOne({ _id: user._id });
        await Investment.deleteOne({ _id: investment._id });
        if (tx) await Transaction.deleteOne({ _id: tx._id });

    } catch (error) {
        console.error("❌ Error:", error);
    } finally {
        await mongoose.disconnect();
    }
};

runVerification();
