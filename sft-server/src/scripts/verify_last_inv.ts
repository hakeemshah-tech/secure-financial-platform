import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Investment from '../models/Investment';

dotenv.config();

/**
 * Prints the most recent investment records with their persisted transaction hash,
 * used to confirm that the hash captured at confirmation time survived the write.
 *
 * Usage: npx tsx src/scripts/verify_last_inv.ts
 */
const verifyDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI as string);
        console.log('✅ Connected to MongoDB');

        const investments = await Investment.find().sort({ createdAt: -1 }).limit(5);

        console.log('🔍 Last 5 Investments:');
        investments.forEach(inv => {
            console.log(`ID: ${inv._id} | Status: ${inv.status} | TxHash: "${inv.txHash}" | Valid: ${inv.txHash !== undefined}`);
        });

        if (investments.length === 0) {
            console.log("No investments found.");
        }

        process.exit();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

verifyDB();
