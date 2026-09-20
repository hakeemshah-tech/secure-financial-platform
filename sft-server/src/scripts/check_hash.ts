import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Global transaction-hash lookup utility.
 *
 * Mirrors the uniqueness guarantee enforced by `services/validationService.isTxHashUnique`
 * so an operator can confirm, out-of-band, whether a given on-chain hash has already been
 * consumed by any settlement collection.
 *
 * Usage: npx tsx src/scripts/check_hash.ts <txHash>
 */
const HashToCheck = process.argv[2] || process.env.TX_HASH_TO_CHECK;

const run = async () => {
    if (!HashToCheck) {
        console.error('❌ No transaction hash supplied. Usage: npx tsx src/scripts/check_hash.ts <txHash>');
        process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGO_URI as string);
        console.log('✅ Connected to MongoDB');

        const collections = ['transactions', 'investments', 'swaprequests'];

        for (const colName of collections) {
            const col = mongoose.connection.collection(colName);
            // Each collection stores the hash under its own field name, so the
            // predicate is selected per collection rather than scanned blindly.
            let query: any = {};
            if (colName === 'transactions') {
                query = { txHash: HashToCheck };
            } else if (colName === 'investments') {
                query = { $or: [{ txHash: HashToCheck }, { sftTxHash: HashToCheck }] };
            } else if (colName === 'swaprequests') {
                query = { $or: [{ userTxHash: HashToCheck }, { adminTxHash: HashToCheck }] };
            }

            const found = await col.findOne(query);
            if (found) {
                console.log(`❌ FOUND in ${colName}:`, found._id);
            } else {
                console.log(`✅ Not found in ${colName}`);
            }
        }

        process.exit(0);
    } catch (e) {
        console.error('❌ Error:', e);
        process.exit(1);
    }
}
run();
