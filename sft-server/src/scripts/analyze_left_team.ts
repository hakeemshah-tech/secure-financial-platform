
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User';
import Investment from '../models/Investment';
import IncomeSettings from '../models/IncomeSettings';

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

const getLeftTreeDetails = async () => {
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

    const settings = await IncomeSettings.findOne();
    console.log(`Matching Income Percentage: ${settings?.matchingIncome}%`);

    console.log(`User: ${user.email}`);
    console.log(`Left Child ID: ${user.leftChild}`);

    if (!user.leftChild) {
        console.log("No left child.");
        process.exit(0);
    }

    const queue = [user.leftChild];
    let totalInvested = 0;

    console.log('--------------------------------------------------');
    console.log('Left Team Details:');

    while (queue.length > 0) {
        const currentId = queue.shift();
        const member = await User.findById(currentId);

        if (!member) continue;

        const investments = await Investment.find({
            user: member._id,
            status: { $in: ['COMPLETED', 'PAID'] }
        });

        const memberTotal = investments.reduce((sum, inv) => sum + (inv.amountSFT || 0), 0);
        totalInvested += memberTotal;

        if (memberTotal > 0) {
            console.log(`- ${member.email} (${member._id})`);
            console.log(`  Invested: ${memberTotal} SFT`);
            investments.forEach((inv: any) => {
                console.log(`    > [${inv.createdAt.toISOString()}] ${inv.amountSFT} SFT (Status: ${inv.status})`);
            });
        }

        if (member.leftChild) queue.push(member.leftChild);
        if (member.rightChild) queue.push(member.rightChild);
    }

    console.log('--------------------------------------------------');
    console.log(`Total Left Volume Calculated: ${totalInvested}`);

    process.exit(0);
};

getLeftTreeDetails();
