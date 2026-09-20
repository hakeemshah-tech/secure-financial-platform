
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User';

dotenv.config();

const fixGhostNodes = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI as string);
        console.log('MongoDB Connected');

        const users = await User.find({}).populate('leftChild').populate('rightChild');
        let fixedCount = 0;

        for (const user of users) {
            let modified = false;

            // Check Left Child
            if (user.leftChild && !user.populated('leftChild')) {
                // Should use strict population check, but with mongoose, if populated doc is missing it might return null or the ID depending on config.
                // However, standard mongoose .populate() returns null if the ref document is missing.
                // WAIT: If the ID exists in the DB field but document is gone, .populate() usually results in `null` for that field in the document object unless configured otherwise.
                // But if we access the raw document, the ID is there.
            }
        }

        // Better approach: Find users where (leftChild IS NOT NULL) AND (leftChild NOT IN Users)
        // Aggregation is safer.

        console.log("Scanning for ghost nodes...");

        const allUsers = await User.find({});
        const userMap = new Set(allUsers.map(u => u._id.toString()));

        for (const user of allUsers) {
            let modified = false;

            if (user.leftChild) {
                if (!userMap.has(user.leftChild.toString())) {
                    console.log(`Found GHOST Left Child in user ${user.email} (${user._id}). ID: ${user.leftChild}`);
                    user.leftChild = undefined;
                    modified = true;
                }
            }

            if (user.rightChild) {
                if (!userMap.has(user.rightChild.toString())) {
                    console.log(`Found GHOST Right Child in user ${user.email} (${user._id}). ID: ${user.rightChild}`);
                    user.rightChild = undefined;
                    modified = true;
                }
            }

            if (modified) {
                await user.save();
                fixedCount++;
                console.log(`Fixed user ${user.email}`);
            }
        }

        console.log(`Scan complete. Fixed ${fixedCount} users.`);
        process.exit();

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

fixGhostNodes();
