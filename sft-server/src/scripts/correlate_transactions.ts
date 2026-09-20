
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Transaction from '../models/Transaction';
import Investment from '../models/Investment';
import User from '../models/User';

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

const correlateTransactions = async () => {
    await connectDB();
    const email = process.argv[2] || process.env.TARGET_USER_EMAIL;
    if (!email) {
        console.error('Provide a user email as the first argument.');
        process.exit(1);
    }
    const user = await User.findOne({ email });

    if (!user) { process.exit(1); }

    const transactions = await Transaction.find({
        user: user._id,
        type: 'MATCHING_INCOME'
    }).sort({ createdAt: 1 });

    console.log('--- Matching Income Transactions ---');
    transactions.forEach((tx: any) => {
        console.log(`[${tx.createdAt.toISOString()}] Amount: ${tx.amountSFT} SFT | ID: ${tx._id}`);
    });

    // Get all investments in the left subtree that could have triggered this
    // We already know from previous step the users, but let's blindly fetch all investments in system to see timing? 
    // No, better to search investments created around the transaction times.

    console.log('\n--- All System Investments around Transaction Times ---');
    // We will look for investments created within 5 seconds of the transaction
    const InvestmentModel = require('../models/Investment').default;

    for (const tx of transactions as any[]) {
        const time = new Date(tx.createdAt);
        const windowStart = new Date(time.getTime() - 5000); // 5 seconds before
        const windowEnd = new Date(time.getTime() + 5000); // 5 seconds after

        const relatedInvestments = await InvestmentModel.find({
            createdAt: { $gte: windowStart, $lte: windowEnd }
        }).populate('user', 'email');

        if (relatedInvestments.length > 0) {
            console.log(`Transaction at ${tx.createdAt.toISOString()} coincided with:`);
            relatedInvestments.forEach((inv: any) => {
                console.log(`  > Investment ${inv._id} by ${inv.user.email}: ${inv.amountSFT} SFT`);
            });
        } else {
            console.log(`Transaction at ${tx.createdAt.toISOString()} had NO nearby investments found.`);
        }
    }

    process.exit(0);
};

correlateTransactions();
