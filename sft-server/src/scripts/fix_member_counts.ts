
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User, { IUser } from '../models/User';

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

    // Return totals including this node
    // Note: This function returns the counts of the SUBTREE rooted at this node.
    // However, for the PARENT's left/right count, they want the count of nodes IN that branch.
    // So if I am counting "Left Count" of User A, it is the total size of the subtree at A.leftChild.
    return {
        total: 1 + leftStats.total + rightStats.total,
        active: (user.isActive ? 1 : 0) + leftStats.active + rightStats.active
    };
};

const fixAllUsers = async () => {
    console.log("Fetching all users who are placed in tree...");
    const users = await User.find({ isPlacedInTree: true });
    console.log(`Found ${users.length} placed users to check.`);

    let fixedCount = 0;

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

        // Check for mismatch
        const needsUpdate =
            user.leftCount !== leftStats.total ||
            user.rightCount !== rightStats.total ||
            user.leftActiveCount !== leftStats.active ||
            user.rightActiveCount !== rightStats.active;

        if (needsUpdate) {
            // console.log(`Mismatch for ${user.email}:`);
            // console.log(`   Left: ${user.leftCount}/${user.leftActiveCount} -> ${leftStats.total}/${leftStats.active}`);
            // console.log(`   Right: ${user.rightCount}/${user.rightActiveCount} -> ${rightStats.total}/${rightStats.active}`);

            user.leftCount = leftStats.total;
            user.rightCount = rightStats.total;
            user.leftActiveCount = leftStats.active;
            user.rightActiveCount = rightStats.active;

            await User.findByIdAndUpdate(user._id, {
                leftCount: leftStats.total,
                rightCount: rightStats.total,
                leftActiveCount: leftStats.active,
                rightActiveCount: rightStats.active
            });
            fixedCount++;
            process.stdout.write('.'); // Progress indicator
        }
    }

    console.log(`\n\n✅ Repair Complete.`);
    console.log(`Fixed ${fixedCount} users out of ${users.length}.`);

    // Optionally spot-check one user: npx tsx src/scripts/fix_member_counts.ts <email>
    const verifyEmail = process.argv[2] || process.env.TARGET_USER_EMAIL;
    const specificUser = verifyEmail ? await User.findOne({ email: verifyEmail }) : null;
    if (specificUser) {
        console.log(`\nVerification for ${verifyEmail}:`);
        console.log(`Left: ${specificUser.leftCount} (Active: ${specificUser.leftActiveCount})`);
        console.log(`Right: ${specificUser.rightCount} (Active: ${specificUser.rightActiveCount})`);
    }

    process.exit();
};

const run = async () => {
    await connectDB();
    await fixAllUsers();
};

run();
