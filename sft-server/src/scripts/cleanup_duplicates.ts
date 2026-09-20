import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Transaction from '../models/Transaction';
import Investment from '../models/Investment';
import SwapRequest from '../models/SwapRequest';
import { connectDB } from '../config/db';

dotenv.config();

const cleanupDuplicates = async () => {
    try {
        await connectDB();
        console.log('✅ Connected to MongoDB');

        // 1. Transaction Duplicates
        const txDuplicates = await Transaction.aggregate([
            { $group: { _id: "$txHash", count: { $sum: 1 }, ids: { $push: "$_id" } } },
            { $match: { count: { $gt: 1 }, _id: { $ne: null } } }
        ]);

        for (const group of txDuplicates) {
            console.log(`Cleaning up Transaction duplicates for hash: ${group._id}`);
            // Keep the first one, delete the rest
            const idsToDelete = group.ids.slice(1);
            await Transaction.deleteMany({ _id: { $in: idsToDelete } });
            console.log(`  Deleted ${idsToDelete.length} records.`);
        }

        // 2. Investment Duplicates (txHash)
        const invDuplicates = await Investment.aggregate([
            { $group: { _id: "$txHash", count: { $sum: 1 }, ids: { $push: "$_id" } } },
            { $match: { count: { $gt: 1 }, _id: { $ne: null } } }
        ]);

        for (const group of invDuplicates) {
            console.log(`Cleaning up Investment duplicates for hash: ${group._id}`);
            const idsToDelete = group.ids.slice(1);
            await Investment.deleteMany({ _id: { $in: idsToDelete } });
            console.log(`  Deleted ${idsToDelete.length} records.`);
        }

        // 3. Investment Duplicates (sftTxHash)
        // ... (Similiar logic if needed, but primary focus is txHash)

        console.log('✅ Cleanup Complete. Indexes should now ideally serve uniqueness.');

        // Force sync indexes
        console.log('🔄 Syncing Indexes...');
        await Transaction.syncIndexes();
        await Investment.syncIndexes();
        await SwapRequest.syncIndexes();
        console.log('✅ Indexes Synced Successfully.');

        process.exit(0);

    } catch (error) {
        console.error('❌ Cleanup failed:', error);
        process.exit(1);
    }
};

cleanupDuplicates();
