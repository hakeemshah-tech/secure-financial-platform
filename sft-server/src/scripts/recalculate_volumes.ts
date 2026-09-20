
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User, { IUser } from '../models/User';
import Investment from '../models/Investment';

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

const calculateSideVolume = async (startNodeId: mongoose.Types.ObjectId): Promise<number> => {
    if (!startNodeId) return 0;

    let totalVolume = 0;
    const queue = [startNodeId];

    while (queue.length > 0) {
        const currentId = queue.shift();
        const user = await User.findById(currentId);

        if (!user) continue;

        // Fetch investments for this user
        const investments = await Investment.find({
            user: user._id,
            status: { $in: ['COMPLETED', 'PAID'] }
        });

        const userVolume = investments.reduce((sum, inv) => sum + (inv.amountSFT || 0), 0);
        totalVolume += userVolume;

        // Add children to queue
        if (user.leftChild) queue.push(user.leftChild);
        if (user.rightChild) queue.push(user.rightChild);
    }

    return totalVolume;
};

const recalculateVolumes = async () => {
    const args = process.argv.slice(2);
    const emailArg = args.find(arg => arg.startsWith('--email='));
    const isUpdate = args.includes('--update');
    const isReconcile = args.includes('--reconcile');
    const isDryRun = args.includes('--dry-run') || (!isUpdate && !isReconcile);

    if (!emailArg) {
        console.error('Please provide --email=<user_email>');
        console.error('Options: --update (to save), --reconcile (to fix matched discrepancy)');
        process.exit(1);
    }

    const email = emailArg.split('=')[1];

    await connectDB();

    const user = await User.findOne({ email });

    if (!user) {
        console.log(`User not found: ${email}`);
        process.exit(1);
    }

    console.log(`Processing user: ${user.email} (${user._id})`);
    console.log('Current Data:');
    console.log(`  Left Volume: ${user.leftVolume}`);
    console.log(`  Right Volume: ${user.rightVolume}`);
    console.log(`  Total Matched: ${user.totalMatched}`);

    let calculatedLeft = 0;
    let calculatedRight = 0;

    if (user.leftChild) {
        console.log('Calculating Left Subtree...');
        calculatedLeft = await calculateSideVolume(user.leftChild);
    }

    if (user.rightChild) {
        console.log('Calculating Right Subtree...');
        calculatedRight = await calculateSideVolume(user.rightChild);
    }

    console.log('--------------------------------------------------');
    console.log('Recalculated Results (Raw):');
    console.log(`  Calculated Left Volume: ${calculatedLeft}`);
    console.log(`  Calculated Right Volume: ${calculatedRight}`);

    // Reconciliation Logic
    let finalLeft = calculatedLeft;
    let finalRight = calculatedRight;

    if (isReconcile) {
        console.log('--------------------------------------------------');
        console.log('Applying Reconciliation (Max(Calculated, Matched))...');

        // We don't know strict split of matched volume (left vs right), but logically:
        // Matched is min(left, right). So BOTH left and right must be >= TotalMatched.
        // If calculated volume is LESS than TotalMatched, we bump it up.

        if (finalLeft < user.totalMatched) {
            console.log(`  Fixing Left: ${finalLeft} -> ${user.totalMatched} (to match paid income)`);
            finalLeft = user.totalMatched;
        }
        if (finalRight < user.totalMatched) {
            console.log(`  Fixing Right: ${finalRight} -> ${user.totalMatched} (to match paid income)`);
            finalRight = user.totalMatched;
        }
    }

    const leftDiff = finalLeft - user.leftVolume;
    const rightDiff = finalRight - user.rightVolume;

    console.log(`  Final Update Left: ${leftDiff > 0 ? '+' : ''}${leftDiff}`);
    console.log(`  Final Update Right: ${leftDiff > 0 ? '+' : ''}${rightDiff}`);

    if (isUpdate || isReconcile) {
        if (finalLeft !== user.leftVolume || finalRight !== user.rightVolume) {
            console.log('Updating user record...');
            user.leftVolume = finalLeft;
            user.rightVolume = finalRight;
            await user.save();
            console.log('✅ User updated successfully.');
        } else {
            console.log('No changes needed.');
        }
    } else {
        console.log('DRY RUN: No changes applied. Use --update or --reconcile to apply.');
    }

    process.exit(0);
};

recalculateVolumes();
