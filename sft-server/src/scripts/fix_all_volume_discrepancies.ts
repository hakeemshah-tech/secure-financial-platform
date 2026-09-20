
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User';
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
        const investments = await Investment.find({ user: user._id, status: { $in: ['COMPLETED', 'PAID'] } });
        totalVolume += investments.reduce((sum, inv) => sum + (inv.amountSFT || 0), 0);
        if (user.leftChild) queue.push(user.leftChild);
        if (user.rightChild) queue.push(user.rightChild);
    }
    return totalVolume;
};

const fixDiscrepancies = async () => {
    const args = process.argv.slice(2);
    const isUpdate = args.includes('--update');

    await connectDB();
    const users = await User.find({ isPlacedInTree: true });

    console.log(`Scanning ${users.length} users for discrepancies...`);
    let discrepancyCount = 0;

    for (const user of users) {
        // Calculate Real Volumes
        let realLeft = 0;
        let realRight = 0;
        if (user.leftChild) realLeft = await calculateSideVolume(user.leftChild);
        if (user.rightChild) realRight = await calculateSideVolume(user.rightChild);

        const storedLeft = user.leftVolume || 0;
        const storedRight = user.rightVolume || 0;
        const storedMatched = user.totalMatched || 0;

        let needsSave = false;
        let logMsg = `Checking User: ${user.email} (${user._id})\n`;

        // Check 1: Volume Accuracy
        if (storedLeft !== realLeft || storedRight !== realRight) {
            logMsg += `  ⚠️ Volume Mismatch! Stored [L:${storedLeft}, R:${storedRight}] vs Real [L:${realLeft}, R:${realRight}]\n`;
            if (isUpdate) {
                user.leftVolume = realLeft;
                user.rightVolume = realRight;
                needsSave = true;
                logMsg += `    -> Updated Volumes to Real.\n`;
            }
        }

        // Check 2: Matched Integrity (Overpayment Check)
        // Matched cannot be > Real Left OR Real Right (Matched is Min(L, R))
        // Actually, matched is strictly limited by the weak leg.
        // If Matched > Real Weak Leg, then we have overpayment (the known overpayment case).

        // However, matched is cumulative history. If volume DROPPED (deleted investment), matched stays high.
        // But in our double-payment case, volume was correct (50), Matched was double (100).

        // So logic: If Matched > Real Left OR Matched > Real Right -> DISCREPANCY.
        // Wait, Matched must be <= Real Left AND Matched <= Real Right?
        // Yes, because Matched means "amount of volume on BOTH sides that has been paid out".

        if (storedMatched > realLeft || storedMatched > realRight) {
            const maxValidMatched = Math.min(realLeft, realRight);
            logMsg += `  ⚠️ Matched Mismatch (Overpayment)! Matched: ${storedMatched} > Real Weak Leg: ${maxValidMatched} (L:${realLeft}, R:${realRight})\n`;

            if (isUpdate) {
                // Reset Matched to the theoretical maximum possible (Weak Leg)
                // This "forgives" the extra money paid but fixes the debt state.
                user.totalMatched = maxValidMatched;
                needsSave = true;
                logMsg += `    -> Reset Total Matched from ${storedMatched} to ${maxValidMatched}.\n`;
            }
        }

        if (logMsg.includes('⚠️')) {
            console.log(logMsg);
            discrepancyCount++;
            if (needsSave && isUpdate) {
                await user.save();
                console.log('    ✅ Saved changes.');
            }
        }
    }

    console.log('--------------------------------------------------');
    console.log(`Scan Complete. Found ${discrepancyCount} users with discrepancies.`);
    if (!isUpdate) console.log('Run with --update to apply fixes.');
    process.exit(0);
};

fixDiscrepancies();
