// @ts-nocheck
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User';
import Investment from '../models/Investment';
import IncomeSettings from '../models/IncomeSettings';
import { placeUserInTree, updateBinaryVolumes, updateActiveUplineCounts } from '../controllers/referralController';
import Transaction from '../models/Transaction';
import Role from '../models/Role';

dotenv.config({ path: '.env' });

const runTest = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI as string);
        console.log("Connected to MongoDB");

        // Cleanup
        await User.deleteMany({ email: { $regex: /test_match_/ } });
        await Investment.deleteMany({ 'user.email': { $regex: /test_match_/ } });
        await Transaction.deleteMany({ type: 'MATCHING_INCOME' });

        // Setup Settings
        let settings = await IncomeSettings.findOne();
        if (!settings) {
            settings = await IncomeSettings.create({ matchingIncome: 5, referralIncome: 5 });
        } else {
            settings.matchingIncome = 5;
            await settings.save();
        }
        console.log("Settings: Matching Income = 5%");

        const role = await Role.findOne({ name: 'user' }) || await Role.create({ name: 'user', permissions: [] });

        // Create Users
        const createUser = async (name: string, referrer?: any, pref: 'left' | 'right' | 'auto' = 'auto') => {
            const userData: any = {
                username: name,
                email: `${name}@test_match_example.com`,
                walletAddress: `0x${name}123`,
                role: role._id,
                referrer: referrer ? referrer._id : undefined,
                placementPreference: pref,
                isPlacedInTree: false,
                isEmailVerified: true,
                referralCode: `REF_${name}_${Date.now()}` // Unique Ref Code
            };
            const user = await User.create(userData);
            return user;
        }

        const createInvestment = async (user: any, amount: number) => {
            const inv = await Investment.create({
                user: user._id,
                walletAddress: user.walletAddress || `0xfake${Date.now()}`,
                amountSFT: amount,
                sftAllocated: amount,
                maturityDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 days
                plan: new mongoose.Types.ObjectId(), // Fake Plan ID
                status: 'COMPLETED'
            });

            // Flag user as active and trigger updates manually (mimicking real flow)
            if (!user.isActive) {
                user.isActive = true;
                await user.save();
                await updateActiveUplineCounts(user._id.toString());
            }

            await updateBinaryVolumes(inv._id.toString());
            return inv;
        }

        console.log("\n--- SCENARIO START ---");

        // 1. Create A
        const A = await createUser('A');
        // Place A (Root)
        await placeUserInTree(A._id.toString());
        await createInvestment(A, 100);
        console.log("Created A and invested 100");

        // 2. A refers B (Left)
        const B = await createUser('B', A);
        // Place B
        await placeUserInTree(B._id.toString());
        await createInvestment(B, 100);
        console.log("Created B (Left), invested 100");

        // 3. A refers C (Right)
        const C = await createUser('C', A);
        await placeUserInTree(C._id.toString());
        await createInvestment(C, 500);
        console.log("Created C (Right), invested 500");

        // CHECK A STATS
        let refA: any = await User.findById(A._id);
        console.log(`\n[CHECK 1] A Stats: L_Vol=${refA?.leftVolume}, R_Vol=${refA?.rightVolume}, Matched=${refA?.totalMatched}`);
        // Expected: L=100, R=500, Matched=100.
        // Activity Check
        console.log(`          A Activity: L_Active=${refA?.leftActiveCount}, R_Active=${refA?.rightActiveCount}`);

        // 4. A or B refers D (Left side, under B)
        const D = await createUser('D', A); // Direct ref A, but will fall to Left under B if A's left is full (B)
        // Ensure placement goes to Left leg of A (since B is there)
        // Actually standard level order: A has B(L), C(R).
        // Next spot is B's Left.
        await placeUserInTree(D._id.toString());
        await createInvestment(D as any, 100);
        console.log("Created D (under B), invested 100");

        // CHECK A STATS
        refA = await User.findById(A._id);
        console.log(`\n[CHECK 2] A Stats: L_Vol=${refA?.leftVolume}, R_Vol=${refA?.rightVolume}, Matched=${refA?.totalMatched}`);
        // Expected: L=200, R=500, Matched=200. (New Match: 100)

        // 5. Create E (Right side, under C)
        // To force E under C, we might need to fill B's right, OR use placement preference.
        // Let's use placement preference on A? Or just rely on order.
        // Current Tree:
        //      A
        //    /   \
        //   B     C
        //  /
        // D
        // Next spots: B->Right, C->Left, C->Right.
        // User wants E to be on Right leg.
        // Let's force place E under C.
        const E = await createUser('E', A);
        // Hack: set A's preference to right temporarily?
        refA.placementPreference = 'right';
        await refA.save();
        await placeUserInTree(E._id.toString());

        await createInvestment(E, 500);
        console.log("Created E (Right side), invested 500");

        // CHECK A STATS
        refA = await User.findById(A._id);
        console.log(`\n[CHECK 3] A Stats: L_Vol=${refA?.leftVolume}, R_Vol=${refA?.rightVolume}, Matched=${refA?.totalMatched}`);

        console.log("\n--- TEST COMPLETE ---");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

runTest();
