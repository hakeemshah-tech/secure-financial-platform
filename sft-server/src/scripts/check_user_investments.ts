
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import User from '../models/User';
import Investment from '../models/Investment';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const checkUserInvestments = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI as string);
        console.log('Connected to DB');

        // Usage: npx tsx src/scripts/check_user_investments.ts <email>
        const email = process.argv[2] || process.env.TARGET_USER_EMAIL;
        if (!email) {
            console.error('Provide a user email as the first argument.');
            process.exit(1);
        }
        const user = await User.findOne({ email });

        if (!user) {
            console.log('User not found');
            return;
        }

        console.log(`User found: ${user.username} (${user._id})`);

        const investments = await Investment.find({ user: user._id });

        console.log('--- Investments ---');
        let total = 0;
        investments.forEach(inv => {
            console.log(`ID: ${inv._id}, Plan: ${inv.plan}, Amount: ${inv.amountSFT}, Status: ${inv.status}`);
            if (['COMPLETED', 'PAID'].includes(inv.status)) {
                total += inv.amountSFT;
            }
        });
        console.log('-------------------');
        console.log(`Calculated Total Personal Investment: ${total}`);

    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
};

checkUserInvestments();
