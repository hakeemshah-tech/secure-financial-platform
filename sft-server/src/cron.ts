import cron from 'node-cron';
import Investment from './models/Investment';
import InvestmentPlan from './models/InvestmentPlan';
import Transaction from './models/Transaction';
import User from './models/User';
// import { checkAndCapIncome } from './services/incomeService';

// Run every midnight (00:00)
// For testing/dev, you might want to run it every minute: '*/1 * * * *'
const CRON_SCHEDULE = '0 0 * * *';

export const processDailyROI = () => {
    cron.schedule(CRON_SCHEDULE, async () => {
        console.log('⏰ Running Daily ROI Distribution Job...');

        try {
            // 1. Find Active Investments
            // Status must be PAID or COMPLETED (assuming these are active states)
            // And not fully paid out yet (checking maturity or accumulated vs allocated)
            const activeInvestments = await Investment.find({
                status: { $in: ['PAID', 'COMPLETED'] },
                requestType: 'INVESTMENT'
            }).populate('plan');

            console.log(`Found ${activeInvestments.length} active investments.`);

            for (const investment of activeInvestments) {
                try {
                    const plan = investment.plan as any;
                    if (!plan) continue;

                    const now = new Date();
                    const maturityDate = new Date(investment.maturityDate);

                    // Skip if already matured (or handle final payout if not done)
                    if (now > maturityDate && investment.accumulatedROI >= (investment.sftAllocated - investment.amountSFT)) {
                        continue;
                    }

                    // Calculate Total Expected ROI
                    const totalROI = investment.sftAllocated - investment.amountSFT;

                    // Daily ROI Amount (Simple Interest: TotalROI / Days)
                    // Precision handling: We calculate what SHOULD be accumulated by today vs what IS accumulated
                    const durationDays = plan.lockInPeriodDays;
                    const dailyROIRate = totalROI / durationDays;

                    // Calculate days elapsed since start
                    const startDate = new Date(investment.startDate);
                    const diffTime = Math.abs(now.getTime() - startDate.getTime());
                    const daysElapsed = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    // Cap days elapsed at duration
                    const effectiveDays = Math.min(daysElapsed, durationDays);

                    // Expected Total ROI up to today
                    const expectedAccumulated = (totalROI / durationDays) * effectiveDays;

                    // Amount to pay TODAY = Expected - AlreadyPaid
                    let amountToPay = expectedAccumulated - investment.accumulatedROI;

                    // Precision Safe-guard:
                    // If this is the last day or we exceeded duration, ensure we exactly match TotalROI
                    if (effectiveDays >= durationDays) {
                        amountToPay = totalROI - investment.accumulatedROI;
                    }

                    if (amountToPay <= 0.000001) {
                        // Already up to date
                        continue;
                    }

                    // [NEW] Check Income Cap - REMOVED (User request: Cap Withdrawal only)
                    // let finalAmount = amountToPay;
                    // let isCapped = false;
                    // const capResult = await checkAndCapIncome(investment.user.toString(), amountToPay);
                    // finalAmount = capResult.amount;
                    // isCapped = capResult.isCapped;

                    // if (isCapped) {
                    //     console.log(`   ⚠️ ROI Capped for inv ${investment._id}. Potential: ${amountToPay}, Paid: ${finalAmount}`);
                    // }
                    const finalAmount = amountToPay;
                    const isCapped = false;

                    if (finalAmount > 0) {
                        // 2. Create ROI Transaction
                        await Transaction.create({
                            user: investment.user,
                            plan: investment.plan,
                            investment: investment._id,
                            type: 'ROI', // Make sure to add ROI to Transaction Enum if strictly typed
                            amountSFT: finalAmount,
                            amountSFTAllocated: finalAmount, // Using finalAmount to track allocated vs potential? Actually allocated usually means potentially allocated. But here we pay what we can. 
                            status: 'COMPLETED',
                            txHash: undefined // Internal credit
                        });

                        // 3. Update Investment Tracker
                        // IMPORTANT: We still increment accumulatedROI by the FULL amountToPay (or logic might get stuck trying to pay the rest forever?)
                        // If we only increment by `finalAmount`, tomorrow it will try to pay the difference again which will fail again.
                        // So we should increment accumulatedROI by `amountToPay` (treating it as "processed") even if we didn't pay it all?
                        // OR we increment by `finalAmount` and let it drift?
                        // If we want to FLUSH the excess, we must treat it as paid. 
                        // So `accumulatedROI` should track the "Theoretical ROI" to know when we are done?
                        // Current logic: `amountToPay = expectedAccumulated - investment.accumulatedROI`.
                        // If we only add `finalAmount`, `investment.accumulatedROI` lags behind. Tomorrow `amountToPay` includes the unpaid part.
                        // Correct Logic for Capping: We FLUSH the excess. So we must mark it as "Processed".
                        // So we increase `accumulatedROI` by `amountToPay` (Full Amount).

                        investment.accumulatedROI += amountToPay;
                        investment.lastROIDate = now;
                        await investment.save();

                        // [NEW] Update User Stats
                        await User.findByIdAndUpdate(investment.user, {
                            $inc: { totalEarnedIncome: finalAmount }
                        });

                        console.log(`💰 Crediting ROI to inv ${investment._id}: ${finalAmount.toFixed(6)} SFT (Day ${effectiveDays}/${durationDays}) ${isCapped ? '[CAPPED]' : ''}`);
                    } else if (isCapped && finalAmount === 0) {
                        // Fully Capped, but we still need to advance the ROI counter so we don't retry locally forever
                        investment.accumulatedROI += amountToPay;
                        investment.lastROIDate = now;
                        await investment.save();
                        console.log(`💰 ROI FLUSHED for inv ${investment._id} (Day ${effectiveDays}/${durationDays})`);
                    }

                } catch (invError) {
                    console.error(`❌ Error processing ROI for investment ${investment._id}:`, invError);
                }
            }
            console.log('✅ Daily ROI Job Completed.');

        } catch (error) {
            console.error('❌ Error in Daily ROI Job:', error);
        }
    });
};


