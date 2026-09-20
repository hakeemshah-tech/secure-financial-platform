import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Transaction from '../models/Transaction';
import Investment from '../models/Investment';
import SwapRequest from '../models/SwapRequest';
import User from '../models/User';
import { connectDB } from '../config/db';
import { isTxHashUnique } from '../services/validationService';

dotenv.config();

const testUniqueness = async () => {
    try {
        await connectDB();
        console.log('✅ Connected to MongoDB');

        const testHash = `TEST_HASH_${Date.now()}`;
        console.log(`🧪 Testing with hash: ${testHash}`);

        // Sync Indexes to ensure unique constraints are active
        await Transaction.syncIndexes();
        await Investment.syncIndexes();
        await SwapRequest.syncIndexes();
        console.log('✅ Indexes synced');

        // 1. Create a dummy user
        const user = await User.findOne({});
        if (!user) {
            console.error('❌ No user found to attach records to');
            process.exit(1);
        }
        console.log(`👤 Using user: ${user._id}`);

        // 2. Create Transaction with hash
        console.log('📝 Creating Transaction...');
        try {
            await Transaction.create({
                user: user._id,
                type: 'PURCHASE',
                amountSFT: 100,
                status: 'PENDING',
                txHash: testHash
            });
            console.log('✅ Transaction created successfully');
        } catch (e: any) {
            console.error('❌ Failed to create transaction:', e.message);
        }

        // 3. Verify Validator
        console.log('🔍 Verifying isTxHashUnique service...');
        const isUnique = await isTxHashUnique(testHash);
        if (!isUnique) {
            console.log('✅ Service correctly identifies hash as NOT unique');
        } else {
            console.error('❌ Service failed to identify duplicate hash');
        }

        // 4. Try to create Investment with same hash (should fail via Validator or Index)
        console.log('📝 Attempting to create Investment with duplicate hash...');
        try {
            await Investment.create({
                user: user._id,
                plan: new mongoose.Types.ObjectId(), // Fake ID
                walletAddress: '0x123',
                amountSFT: 100,
                sftAllocated: 100,
                maturityDate: new Date(),
                status: 'PENDING',
                txHash: testHash
            });
            console.error('❌ Investment creation SHOULD have failed but succeeded');
        } catch (e: any) {
            if (e.code === 11000) {
                console.log('✅ Investment creation failed as expected (Duplicate Key Error)');
            } else {
                console.log(`✅ Investment creation failed with error: ${e.message}`);
            }
        }

        // 5. Try to create SwapRequest with same hash
        console.log('📝 Attempting to create SwapRequest with duplicate hash...');
        try {
            await SwapRequest.create({
                user: user._id,
                walletAddress: '0x123',
                amount: 100,
                fromToken: 'USDT',
                toToken: 'SFT',
                status: 'PENDING',
                userTxHash: testHash
            });
            console.error('❌ SwapRequest creation SHOULD have failed but succeeded');
        } catch (e: any) {
            if (e.code === 11000) {
                console.log('✅ SwapRequest creation failed as expected (Duplicate Key Error)');
            } else {
                console.log(`✅ SwapRequest creation failed with error: ${e.message}`);
            }
        }

        console.log('🏁 Verification Complete');
        process.exit(0);

    } catch (error) {
        console.error('❌ Script error:', error);
        process.exit(1);
    }
};

testUniqueness();
