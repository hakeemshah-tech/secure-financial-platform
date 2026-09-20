import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Transaction from '../models/Transaction';
import Investment from '../models/Investment';
import SwapRequest from '../models/SwapRequest';
import { connectDB } from '../config/db';

dotenv.config();

const inspectIndexes = async () => {
    try {
        await connectDB();
        console.log('✅ Connected to MongoDB');

        console.log('--- Transaction Indexes ---');
        console.log(await Transaction.listIndexes());

        console.log('--- Investment Indexes ---');
        console.log(await Investment.listIndexes());

        console.log('--- SwapRequest Indexes ---');
        console.log(await SwapRequest.listIndexes());

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

inspectIndexes();
