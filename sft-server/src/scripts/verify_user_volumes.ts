
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User';
import Investment from '../models/Investment';

// Load env vars
dotenv.config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI as string);
        console.log('MongoDB Connected');
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

const calculateSubtreeVolume = async (rootId: any): Promise<number> => {
    if (!rootId) return 0;

    // Get this user's investments
    const investments = await Investment.find({
        user: rootId,
        status: { $in: ['COMPLETED', 'PAID'] }
    });

    const personalVolume = investments.reduce((sum, inv) => sum + (inv.amountSFT || 0), 0);

    const user = await User.findById(rootId);
    if (!user) return personalVolume;

    let leftVol = 0;
    let rightVol = 0;

    if (user.leftChild) {
        leftVol = await calculateSubtreeVolume(user.leftChild);
    }
    if (user.rightChild) {
        rightVol = await calculateSubtreeVolume(user.rightChild);
    }

    return personalVolume + leftVol + rightVol;
};


const verifyAllUsers = async () => {
    console.log("Fetching all users...");
    const users = await User.find({ isPlacedInTree: true });
    console.log(`Found ${users.length} placed users.`);

    let issuesFound = 0;

    for (const user of users) {
        // console.log(`Checking ${user.username || user.email}...`);
        const calculatedLeft = user.leftChild ? await calculateSubtreeVolume(user.leftChild) : 0;
        const calculatedRight = user.rightChild ? await calculateSubtreeVolume(user.rightChild) : 0;

        const diffLeft = user.leftVolume - calculatedLeft;
        const diffRight = user.rightVolume - calculatedRight;

        if (diffLeft !== 0 || diffRight !== 0) {
            console.log(`❌ Mismatch for ${user.username} (${user.email})`);
            console.log(`   Left: Stored ${user.leftVolume} | Actual ${calculatedLeft} (Diff: ${diffLeft})`);
            console.log(`   Right: Stored ${user.rightVolume} | Actual ${calculatedRight} (Diff: ${diffRight})`);
            issuesFound++;
        }
    }

    console.log(`\nScan Complete. ${issuesFound} users have volume mismatches.`);
    process.exit();
};

const run = async () => {
    await connectDB();
    await verifyAllUsers();
};

run();
