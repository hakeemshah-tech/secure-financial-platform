import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Dumps a single raw investment document straight from the driver, bypassing the
 * Mongoose schema cast. Used to inspect orphaned ("zombie") records whose shape
 * no longer satisfies the current model definition.
 *
 * Usage: npx tsx src/scripts/view_zombie.ts <investmentId>
 */
const ID = process.argv[2] || process.env.INVESTMENT_ID;

const run = async () => {
    if (!ID || !mongoose.Types.ObjectId.isValid(ID)) {
        console.error('❌ Provide a valid investment ObjectId. Usage: npx tsx src/scripts/view_zombie.ts <investmentId>');
        process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGO_URI as string);
        const Investment = mongoose.connection.collection('investments');
        const inv = await Investment.findOne({ _id: new mongoose.Types.ObjectId(ID) });
        console.log('Investment:', JSON.stringify(inv, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
