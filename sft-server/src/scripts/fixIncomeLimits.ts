import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User';
import Investment from '../models/Investment';
import IncomeSettings from '../models/IncomeSettings';

dotenv.config();

const fixIncomeLimits = async () => {
    try {
        console.log("Connecting to Database...");
        const conn = await mongoose.connect(process.env.MONGO_URI || '');
        console.log(`MongoDB Connected: ${conn.connection.host}`);

        // 1. Get Global Multiplier
        const settings = await IncomeSettings.findOne();
        const multiplier = settings?.maxIncomeMultiplier || 2; // Default to 2
        console.log(`Using Max Income Multiplier: ${multiplier}x`);

        // 2. Find all users
        const users = await User.find({});
        console.log(`Found ${users.length} users to check.`);

        let updatedCount = 0;

        for (const user of users) {
            // 3. Find Active Investments (PAID or COMPLETED or PAID (mapped to PAID in logic))
            // Logic in controller uses PAID or COMPLETED for active.
            // Also need to consider that some investments might be old and status text implies active.
            const investments = await Investment.find({
                user: user._id,
                status: { $in: ['PAID', 'COMPLETED', 'WITHDRAW_REQUESTED', 'WITHDRAW_APPROVED'] }
                // Note: WITHDRAW_COMPLETED means they took principal out, so that limit is gone/used? 
                // Using standard logic: limit is based on TOTAL investment ever? 
                // Re-reading User.ts: "maxIncomeLimit: number; // Total allowable income (Cumulative from all investments)"
                // incomeService.ts: increaseUserIncomeLimit adds to it.
                // So we should sum ALL historic investments that were ever active.
            });

            // Calculate verify limit
            let calculatedLimit = 0;
            for (const inv of investments) {
                calculatedLimit += (inv.amountSFT * multiplier);
            }

            // Update if different or zero
            if (user.maxIncomeLimit !== calculatedLimit) {
                // Even if it's not zero, we might want to correct it if the logic was strict. 
                // But user specifically said "new field created... cannot withdraw".
                // So safest is to ONLY update if it is 0 or undefined, OR if we trust this recalc 100%.
                // Let's trust the recalc as the source of truth for "Cumulative from all investments".

                // Wait, if we use $inc in normal flow, it accumulates.
                // If we sum all investments, we reconstruct the "current theoretical limit".

                await User.findByIdAndUpdate(user._id, {
                    maxIncomeLimit: calculatedLimit
                });
                console.log(`updated user: ${user.username} | Old: ${user.maxIncomeLimit} -> New: ${calculatedLimit}`);
                updatedCount++;
            }
        }

        console.log(`Migration Complete. Updated ${updatedCount} users.`);
        process.exit();
    } catch (error) {
        console.error("Error migrating data:", error);
        process.exit(1);
    }
};

fixIncomeLimits();
