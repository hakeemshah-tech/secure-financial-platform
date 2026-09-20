import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Role from './models/Role';
import User from './models/User';
import { connectDB } from './config/db';

dotenv.config();

const seedRoles = async () => {
    try {
        await connectDB();

        const roles = [
            { name: 'user', description: 'Standard user' },
            { name: 'moderator', description: 'Community moderator' },
            { name: 'admin', description: 'System administrator' }
        ];

        for (const role of roles) {
            const exists = await Role.findOne({ name: role.name });
            if (!exists) {
                await Role.create(role);
                console.log(`Role [${role.name}] created`);
            } else {
                console.log(`Role [${role.name}] already exists`);
            }
        }

        // Seed Admin User
        const adminRole = await Role.findOne({ name: 'admin' });
        if (adminRole) {
            const existingAdmin = await User.findOne({
                $or: [
                    { email: process.env.ADMIN_EMAIL || 'admin@example.com' },
                    { referralCode: 'ADMIN_REF' }
                ]
            });

            if (existingAdmin) {
                existingAdmin.email = process.env.ADMIN_EMAIL || 'admin@example.com';
                existingAdmin.password = process.env.ADMIN_PASSWORD || 'password123';
                existingAdmin.walletAddress = process.env.ADMIN_WALLET_ADDRESS || 'G_ADMIN_WALLET_PLACEHOLDER';
                await existingAdmin.save();
                console.log(`Admin user [${existingAdmin.email}] updated`);
            } else {
                await User.create({
                    email: process.env.ADMIN_EMAIL || 'admin@example.com',
                    password: process.env.ADMIN_PASSWORD || 'password123', // Will be hashed by pre-save hook
                    role: adminRole._id,
                    walletAddress: process.env.ADMIN_WALLET_ADDRESS || 'G_ADMIN_WALLET_PLACEHOLDER',
                    referralCode: 'ADMIN_REF'
                });
                console.log(`Admin user [${process.env.ADMIN_EMAIL}] created`);
            }
        }

        console.log('Seeding completed');
        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

seedRoles();
