
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User';

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

interface TreeStats {
    total: number;
    active: number;
}

// Recursively calculate counts for a node's subtree
const calculateTreeStats = async (rootId: any): Promise<TreeStats> => {
    if (!rootId) return { total: 0, active: 0 };

    const user = await User.findById(rootId).select('leftChild rightChild isActive');
    if (!user) return { total: 0, active: 0 };

    let leftStats = { total: 0, active: 0 };
    let rightStats = { total: 0, active: 0 };

    if (user.leftChild) {
        leftStats = await calculateTreeStats(user.leftChild);
    }
    if (user.rightChild) {
        rightStats = await calculateTreeStats(user.rightChild);
    }

    return {
        total: 1 + leftStats.total + rightStats.total,
        active: (user.isActive ? 1 : 0) + leftStats.active + rightStats.active
    };
};

const verifyAllUsers = async () => {
    console.log("Verifying all users...");
    const users = await User.find({ isPlacedInTree: true });
    console.log(`Scanning ${users.length} placed users.`);

    let issuesFound = 0;

    for (const user of users) {
        // Calculate counts for Left Child
        let leftStats = { total: 0, active: 0 };
        if (user.leftChild) {
            leftStats = await calculateTreeStats(user.leftChild);
        }

        // Calculate counts for Right Child
        let rightStats = { total: 0, active: 0 };
        if (user.rightChild) {
            rightStats = await calculateTreeStats(user.rightChild);
        }

        // Check for mismatch (Read Only)
        const hasIssue =
            user.leftCount !== leftStats.total ||
            user.rightCount !== rightStats.total ||
            user.leftActiveCount !== leftStats.active ||
            user.rightActiveCount !== rightStats.active;

        if (hasIssue) {
            console.log(`❌ Mismatch for ${user.email}:`);
            console.log(`   Left: Stored ${user.leftCount} -> Actual ${leftStats.total}`);
            console.log(`   Right: Stored ${user.rightCount} -> Actual ${rightStats.total}`);
            issuesFound++;
        }
    }

    if (issuesFound === 0) {
        console.log(`\n✅ All ${users.length} users verified. No discrepancies found.`);
    } else {
        console.log(`\n❌ Found ${issuesFound} users with discrepancies.`);
    }

    process.exit();
};

const run = async () => {
    await connectDB();
    await verifyAllUsers();
};

run();
