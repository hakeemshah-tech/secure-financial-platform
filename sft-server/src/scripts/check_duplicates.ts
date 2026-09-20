import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Transaction from '../models/Transaction';
import Investment from '../models/Investment';
import SwapRequest from '../models/SwapRequest';
import { connectDB } from '../config/db';

dotenv.config();

const findDuplicates = async () => {
    try {
        await connectDB();
        console.log('✅ Connected to MongoDB');

        // Check Transactions
        const txDuplicates = await Transaction.aggregate([
            { $group: { _id: "$txHash", count: { $sum: 1 }, ids: { $push: "$_id" } } },
            { $match: { count: { $gt: 1 }, _id: { $ne: null } } }
        ]);
        console.log(`🔍 Found ${txDuplicates.length} duplicate sets in Transactions:`);
        txDuplicates.forEach(d => console.log(`   - Hash: ${d._id}, Count: ${d.count}, IDs: ${d.ids.join(', ')}`));

        // Check Investments
        const invDuplicates = await Investment.aggregate([
            { $group: { _id: "$txHash", count: { $sum: 1 }, ids: { $push: "$_id" } } },
            { $match: { count: { $gt: 1 }, _id: { $ne: null } } }
        ]);
        console.log(`🔍 Found ${invDuplicates.length} duplicate sets in Investments:`);
        invDuplicates.forEach(d => console.log(`   - Hash: ${d._id}, Count: ${d.count}, IDs: ${d.ids.join(', ')}`));

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

findDuplicates();
