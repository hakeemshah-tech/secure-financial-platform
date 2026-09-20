
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User';
import Transaction from '../models/Transaction';

dotenv.config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI as string);
        console.log('MongoDB connected');
    } catch (err) {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    }
};

const checkTransactions = async () => {
    await connectDB();

    const email = process.argv[2] || process.env.TARGET_USER_EMAIL;
    if (!email) {
        console.error('Provide a user email as the first argument.');
        process.exit(1);
    }
    const user = await User.findOne({ email });

    if (!user) {
        console.log(`User not found: ${email}`);
        process.exit(1);
    }

    const transactions = await Transaction.find({ user: user._id }).sort({ createdAt: 1 });

    console.log(`Transaction History for ${email}:`);
    transactions.forEach((tx: any) => {
        console.log(`- [${tx.createdAt.toISOString()}] ${tx.type}: ${tx.amountSFT} SFT (Status: ${tx.status})`);
    });

    // Sum matching income
    const matching = transactions
        .filter((tx: any) => tx.type === 'MATCHING_INCOME' && tx.status === 'COMPLETED')
        .reduce((sum: number, tx: any) => sum + (tx.amountSFT || 0), 0);

    console.log('--------------------------------------------------');
    console.log(`Total MATCHING_INCOME: ${matching}`);
    console.log('--------------------------------------------------');

    // Also check for any 'PAID' investments (although recalculated volume already did that)
    const Investment = require('../models/Investment').default;
    const investments = await Investment.find({ user: user._id });
    console.log('Investments:');
    investments.forEach((inv: any) => {
        console.log(`- [${inv.createdAt.toISOString()}] ${inv.amountSFT} SFT (Status: ${inv.status})`);
    });

    process.exit(0);
};

checkTransactions();
