
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

const countSubtreeMembers = async (rootId: any): Promise<{ total: number, active: number }> => {
    if (!rootId) return { total: 0, active: 0 };

    const user = await User.findById(rootId);
    if (!user) return { total: 0, active: 0 };

    let leftStats = { total: 0, active: 0 };
    let rightStats = { total: 0, active: 0 };

    if (user.leftChild) {
        leftStats = await countSubtreeMembers(user.leftChild);
    }
    if (user.rightChild) {
        rightStats = await countSubtreeMembers(user.rightChild);
    }

    // Include self in the count (but for the caller, this node is a child/subtree root)
    return {
        total: 1 + leftStats.total + rightStats.total,
        active: (user.isActive ? 1 : 0) + leftStats.active + rightStats.active
    };
};

const auditUser = async (email: string) => {
    console.log(`Auditing user: ${email}...`);
    const user = await User.findOne({ email });

    if (!user) {
        console.log(`❌ User ${email} not found.`);
        process.exit(1);
    }

    console.log(`User ID: ${user._id}`);
    console.log(`Stored Counts -> Left: ${user.leftCount}, Right: ${user.rightCount}`);
    console.log(`Stored Active -> Left: ${user.leftActiveCount}, Right: ${user.rightActiveCount}`);

    let actualLeft = { total: 0, active: 0 };
    let actualRight = { total: 0, active: 0 };

    if (user.leftChild) {
        actualLeft = await countSubtreeMembers(user.leftChild);
    }
    if (user.rightChild) {
        actualRight = await countSubtreeMembers(user.rightChild);
    }

    console.log(`\nAUDIT RESULTS:`);
    console.log(`LEFT SIDE:`);
    console.log(`   Stored: ${user.leftCount} (Active: ${user.leftActiveCount})`);
    console.log(`   Actual: ${actualLeft.total} (Active: ${actualLeft.active})`);

    if (user.leftCount !== actualLeft.total || user.leftActiveCount !== actualLeft.active) {
        console.log(`   ❌ MISMATCH ON LEFT`);
    } else {
        console.log(`   ✅ MATCH`);
    }

    console.log(`RIGHT SIDE:`);
    console.log(`   Stored: ${user.rightCount} (Active: ${user.rightActiveCount})`);
    console.log(`   Actual: ${actualRight.total} (Active: ${actualRight.active})`);

    if (user.rightCount !== actualRight.total || user.rightActiveCount !== actualRight.active) {
        console.log(`   ❌ MISMATCH ON RIGHT`);
    } else {
        console.log(`   ✅ MATCH`);
    }

    process.exit();
};

// Usage: npx tsx src/scripts/audit_member_counts.ts <email>
const run = async () => {
    const email = process.argv[2] || process.env.TARGET_USER_EMAIL;
    if (!email) {
        console.error('Provide a user email as the first argument.');
        process.exit(1);
    }
    await connectDB();
    await auditUser(email);
};

run();
