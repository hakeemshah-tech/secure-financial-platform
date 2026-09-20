import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User';
import Investment from '../models/Investment';
import IncomeSettings from '../models/IncomeSettings';
import Transaction from '../models/Transaction';
import { increaseUserIncomeLimit, checkAndCapIncome } from '../services/incomeService';

dotenv.config();

const runTest = async () => {
    try {
        console.log("🚀 Starting Income Cap Test...");
        await mongoose.connect(process.env.MONGO_URI as string);
        console.log("✅ Connected to DB");

        // 1. Setup Settings
        let settings = await IncomeSettings.findOne();
        if (!settings) {
            settings = await IncomeSettings.create({
                referralIncome: 10, matchingIncome: 10, maxIncomeMultiplier: 2
            });
        } else {
            settings.maxIncomeMultiplier = 2; // ENFORCE 2x for test
            await settings.save();
        }
        console.log(`✅ Settings: Multiplier set to ${settings.maxIncomeMultiplier}x`);

        // 2. Create Test User
        const testEmail = `test_cap_${Date.now()}@test.com`;
        const user = await User.create({
            walletAddress: `0x${Date.now()}`,
            email: testEmail,
            username: `user_${Date.now()}`,
            isActive: false,
            referralCode: `REF_${Date.now()}`,
            role: new mongoose.Types.ObjectId() // Dummy role ID if needed, or skip if not strict
        });
        console.log(`✅ User Created: ${user.email} (Limit: ${user.maxIncomeLimit})`);

        // 3. Simulate Investment 1 (100 SFT)
        // We manually call the service function as if controller did it
        const invAmount1 = 100;
        await increaseUserIncomeLimit(user._id.toString(), invAmount1);

        let userAfterInv1 = await User.findById(user._id);
        console.log(`✅ Investment 1 (${invAmount1}): Limit is now ${userAfterInv1?.maxIncomeLimit} (Expected 200)`);
        if (userAfterInv1?.maxIncomeLimit !== 200) throw new Error("Limit calc failed!");

        // 4. Simulate Income 1 (150 SFT)
        console.log("👉 Attempting to pay 150 SFT...");
        const cap1 = await checkAndCapIncome(user._id.toString(), 150);
        console.log(`   Result: Pay ${cap1.amount}, Capped: ${cap1.isCapped}`);

        if (cap1.amount !== 150) throw new Error("Should pay full 150!");

        // Manually credit (simulating controller)
        await User.findByIdAndUpdate(user._id, { $inc: { totalEarnedIncome: cap1.amount } });

        // 5. Simulate Income 2 (100 SFT) - Should catch part
        console.log("👉 Attempting to pay 100 SFT (Limit remaining: 50)...");
        const cap2 = await checkAndCapIncome(user._id.toString(), 100);
        console.log(`   Result: Pay ${cap2.amount}, Capped: ${cap2.isCapped}`);

        if (cap2.amount !== 50 || !cap2.isCapped) throw new Error("Should be capped at 50!");

        await User.findByIdAndUpdate(user._id, { $inc: { totalEarnedIncome: cap2.amount } });

        // 6. Verify Totals
        let userFinal = await User.findById(user._id);
        console.log(`✅ User Stats: Limit ${userFinal?.maxIncomeLimit}, Earned ${userFinal?.totalEarnedIncome}`);
        if (userFinal?.totalEarnedIncome !== 200) throw new Error("Total Earned should be 200!");

        // 7. Invest Again (100 SFT)
        console.log("👉 Investing another 100 SFT...");
        await increaseUserIncomeLimit(user._id.toString(), 100);

        let userReinvest = await User.findById(user._id);
        console.log(`✅ New Limit: ${userReinvest?.maxIncomeLimit} (Expected 400)`);
        if (userReinvest?.maxIncomeLimit !== 400) throw new Error("Reinvest limit update failed!");

        // 8. Simulate Income 3 (100 SFT) - Should pass now
        const cap3 = await checkAndCapIncome(user._id.toString(), 100);
        console.log(`   Result: Pay ${cap3.amount}, Capped: ${cap3.isCapped}`);
        if (cap3.amount !== 100) throw new Error("Should pay full 100 after reinvest!");

        console.log("🎉 TEST PASSED SUCCESSFULLY!");

    } catch (error) {
        console.error("❌ Test Failed:", error);
    } finally {
        await mongoose.connection.close();
    }
};

runTest();
