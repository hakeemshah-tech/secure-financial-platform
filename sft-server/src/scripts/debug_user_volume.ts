
import mongoose from 'mongoose';
import dotenv from 'dotenv';
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

const checkUser = async () => {
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

    console.log('User Data:', JSON.stringify(user.toJSON(), null, 2));
    process.exit(0);
};

checkUser();
