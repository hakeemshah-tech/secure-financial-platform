import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import Role from '../models/Role';
import { Keypair } from 'stellar-sdk';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { placeUserInTree } from './referralController';
import { logAudit } from '../utils/auditLogger';
import sendVerificationEmail, { sendPasswordResetEmail, sendOtpEmail } from '../utils/emailService';
import { notifyUser, notifyAdmins } from './notificationController';

export const generateToken = (id: string) => {
    return jwt.sign({ id }, process.env.JWT_SECRET as string, {
        expiresIn: '30d',
    });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = async (req: Request, res: Response) => {
    const { email, password, referralCode, username, phoneNumber, dateOfBirth, zipCode, country, position, placement } = req.body;

    try {
        const userExists: any = await User.findOne({ email });
        if (userExists) {
            if (userExists.isEmailVerified) {
                return res.status(400).json({ message: 'User already exists' });
            }

            // User exists but is not verified. Allow re-registration.
            if (username && userExists.username !== username) {
                const usernameExists = await User.findOne({ username });
                if (usernameExists && usernameExists._id.toString() !== userExists._id.toString()) {
                    return res.status(400).json({ message: 'Username already taken' });
                }
                userExists.username = username;
            }

            userExists.password = password;
            userExists.phoneNumber = phoneNumber;
            userExists.dateOfBirth = dateOfBirth;
            userExists.zipCode = zipCode;
            userExists.country = country;

            // Handle Referrer Update (Only if not already placed in tree)
            if (referralCode && !userExists.isPlacedInTree) {
                const referrerUser = await User.findOne({ referralCode });
                if (referrerUser) {
                    userExists.referrer = referrerUser._id;
                }
            }

            userExists.emailVerificationToken = crypto.randomBytes(32).toString('hex');
            userExists.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

            await userExists.save();

            // Resend verification email
            // [MODIFIED] Disabled automatic email verification on signup per user request
            // if (userExists.emailVerificationToken) {
            //    await sendVerificationEmail(userExists.email, userExists.emailVerificationToken);
            // }

            await placeUserInTree(userExists._id.toString());
            await userExists.populate('role');

            await logAudit({
                userId: userExists._id.toString(),
                action: 'REGISTER_RETRY',
                details: 'User re-registered (updated details and resent verification)',
                ipAddress: req.ip,
                resourceType: 'User',
                resourceId: userExists._id.toString(),
            });

            return res.status(200).json({
                _id: userExists._id,
                username: userExists.username,
                email: userExists.email,
                phoneNumber: userExists.phoneNumber,
                dateOfBirth: userExists.dateOfBirth,
                zipCode: userExists.zipCode,
                country: userExists.country,
                role: (userExists.role as any).name,
                isActive: userExists.isActive,
                referralCode: userExists.referralCode,
                message: 'Registration updated.',
                token: generateToken((userExists._id as unknown) as string)
            });
        }

        const usernameExists = await User.findOne({ username });
        if (usernameExists) {
            return res.status(400).json({ message: 'Username already taken' });
        }

        const userRole = await Role.findOne({ name: 'user' });
        if (!userRole) throw new Error('Role not found');

        let referrerUser = null;
        if (referralCode) {
            referrerUser = await User.findOne({ referralCode });
        }

        const user = await User.create({
            username,
            email,
            phoneNumber,
            dateOfBirth,
            zipCode,
            country,
            password,
            walletAddress: 'PENDING_' + crypto.randomBytes(4).toString('hex'), // Placeholder until wallet connect
            role: userRole._id,
            referralCode: crypto.randomBytes(4).toString('hex'),
            referrer: referrerUser ? referrerUser._id : undefined,
            emailVerificationToken: crypto.randomBytes(32).toString('hex'),
            emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        });

        // Send verification email
        // [MODIFIED] Disabled automatic email verification on signup per user request
        // if (user.emailVerificationToken) {
        //    await sendVerificationEmail(user.email!, user.emailVerificationToken);
        // }

        await placeUserInTree(user._id.toString(), position, placement);

        await user.populate('role');

        await logAudit({
            userId: user._id.toString(),
            action: 'REGISTER',
            details: 'User registered',
            ipAddress: req.ip,
            resourceType: 'User',
            resourceId: user._id.toString(),
        });

        if (referrerUser) {
            await logAudit({
                userId: referrerUser._id.toString(),
                action: 'REFERRAL_SUCCESS',
                details: `User ${user.username} registered using your referral code`,
                resourceType: 'User',
                resourceId: user._id.toString(),
            });
        }

        // Notify Admins
        await notifyAdmins('New User Registered', `New user registered: ${username} (${email})`, 'INFO');

        res.status(201).json({
            _id: user._id,
            username: user.username,
            email: user.email,
            phoneNumber: user.phoneNumber,
            dateOfBirth: user.dateOfBirth,
            zipCode: user.zipCode,
            country: user.country,
            role: (user.role as any).name,
            isActive: user.isActive,
            isEmailVerified: user.isEmailVerified,
            referralCode: user.referralCode,
            message: 'Registration successful.',
            token: generateToken((user._id as unknown) as string)
        });
    } catch (error: any) {
        res.status(500).json({ message: process.env.NODE_ENV === 'production' ? 'Server Error' : error.message });
    }
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req: Request, res: Response) => {
    const { email, password } = req.body;

    try {
        const user: any = await User.findOne({ email }).populate('role');

        if (user && (await user.matchPassword(password))) {
            if (user.isBlocked) {
                return res.status(403).json({ message: 'your account blocked by admin if you want loggin please contact them' });
            }

            const isUserAdmin = user.role && (user.role.name === 'admin' || user.role.name === 'Admin');

            // [MODIFIED] Removed mandatory email verification check here. 
            // Users can login but will be restricted from withdrawals until verified.
            // if (!user.isEmailVerified && !isUserAdmin) { ... }

            // [NEW] Admin 2FA Logic
            if (isUserAdmin) {
                const otp = crypto.randomInt(100000, 999999).toString();
                const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 Minutes

                user.otp = otp;
                user.otpExpires = otpExpires;
                await user.save();

                await sendOtpEmail(user.email, otp);

                return res.status(202).json({
                    message: 'Admin 2FA required',
                    require2fa: true,
                    email: user.email // Send back email to confirm who we are verifying
                });
            }

            // [NEW] Legacy Support: Generate referral code if missing
            if (!user.referralCode) {
                user.referralCode = crypto.randomBytes(4).toString('hex');
                await user.save();
            }

            res.json({
                _id: user._id,
                username: user.username,
                email: user.email,
                phoneNumber: user.phoneNumber,
                dateOfBirth: user.dateOfBirth,
                zipCode: user.zipCode,
                country: user.country,
                walletAddress: user.walletAddress,
                role: user.role.name,
                isActive: user.isActive,
                isBlocked: user.isBlocked, // Return block status (though likely false here)
                isEmailVerified: user.isEmailVerified, // [NEW] Return verification status
                referralCode: user.referralCode, // Return this explicitly
                token: generateToken((user._id as unknown) as string),
            });

            await logAudit({
                userId: user._id.toString(),
                action: 'LOGIN',
                details: 'User logged in successfully',
                ipAddress: req.ip,
                resourceType: 'User',
                resourceId: user._id.toString(),
            });

            // Notify User of New Login (Async, don't await blocking response)
            notifyUser(user._id.toString(), 'New Login', `A new login was detected on your account.`);

        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error: any) {
        res.status(500).json({ message: process.env.NODE_ENV === 'production' ? 'Server Error' : error.message });
    }
};

// @desc    Verify Admin OTP
// @route   POST /api/auth/verify-otp
// @access  Public
export const verifyAdminOtp = async (req: Request, res: Response) => {
    const { email, otp } = req.body;

    try {
        const user: any = await User.findOne({ email }).populate('role');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.otp !== otp || !user.otpExpires || user.otpExpires < new Date()) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        // Clear OTP after successful verification
        user.otp = undefined;
        user.otpExpires = undefined;

        // Ensure referral code exists (consistency with login)
        if (!user.referralCode) {
            user.referralCode = crypto.randomBytes(4).toString('hex');
        }
        await user.save();

        res.json({
            _id: user._id,
            username: user.username,
            email: user.email,
            phoneNumber: user.phoneNumber,
            dateOfBirth: user.dateOfBirth,
            zipCode: user.zipCode,
            country: user.country,
            walletAddress: user.walletAddress,
            role: user.role.name,
            isActive: user.isActive,
            isBlocked: user.isBlocked,
            referralCode: user.referralCode,
            token: generateToken((user._id as unknown) as string),
        });

        await logAudit({
            userId: user._id.toString(),
            action: 'LOGIN_2FA',
            details: 'Admin logged in with 2FA successfully',
            ipAddress: req.ip,
            resourceType: 'User',
            resourceId: user._id.toString(),
        });

        notifyAdmins('Admin Login', `Admin ${user.username} logged in via 2FA`, 'INFO');

    } catch (error: any) {
        res.status(500).json({ message: process.env.NODE_ENV === 'production' ? 'Server Error' : error.message });
    }
};

// @desc    Link wallet to existing user
// @route   POST /api/auth/link-wallet
// @access  Private
export const linkWallet = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (!user || !user._id) {
            console.error("Link Wallet Error: User not found in request", user);
            return res.status(401).json({ message: 'User not authenticated' });
        }

        const userId = user._id;
        const { walletAddress } = req.body;

        console.log(`Linking wallet ${walletAddress} to user ${userId}`);

        // Check if wallet is already taken by ANOTHER user
        const existingWalletUser = await User.findOne({ walletAddress });
        if (existingWalletUser && existingWalletUser._id.toString() !== userId.toString()) {
            console.warn(`Wallet ${walletAddress} is already linked to user ${existingWalletUser._id}`);
            return res.status(400).json({ message: 'This wallet address is already linked to another account.' });
        }

        const dbUser = await User.findById(userId);
        if (dbUser) {
            dbUser.walletAddress = walletAddress;
            await dbUser.save();
            console.log("Wallet linked successfully in DB");

            await logAudit({
                userId: userId,
                action: 'LINK_WALLET',
                details: `Wallet ${walletAddress} linked to user ${dbUser.email}`,
                resourceType: 'User',
                resourceId: userId,
                ipAddress: req.ip,
                changes: { walletAddress: { old: 'PENDING...', new: walletAddress } }
            });

            res.json({ message: 'Wallet linked successfully', walletAddress });
        } else {
            console.error(`User ${userId} not found in DB during link`);
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error: any) {
        console.error("Link Wallet Exception:", error);
        res.status(500).json({ message: process.env.NODE_ENV === 'production' ? 'Server Error' : error.message });
    }
}

// @desc    Unlink wallet from user
// @route   POST /api/auth/unlink-wallet
// @access  Private
export const unlinkWallet = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (!user || !user._id) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        const dbUser = await User.findById(user._id).populate('role');
        if (dbUser) {
            console.log(`Unlinking wallet for user: ${dbUser.email}, Role: ${(dbUser.role as any)?.name}`);

            // Unlink wallet in User model
            const oldWallet = dbUser.walletAddress;
            dbUser.walletAddress = 'PENDING_' + crypto.randomBytes(4).toString('hex');
            await dbUser.save();

            // [NEW] If user is ADMIN, also clear the global 'active_network' setting
            // This ensures users don't see a stale network
            if ((dbUser.role as any)?.name === 'admin') {
                console.log("User is admin, attempting to clear active_network...");
                const SystemConfig = (await import('../models/SystemConfig')).default;
                const deleteResult = await SystemConfig.findOneAndDelete({ key: 'active_network' });
                console.log("Admin unlinked wallet: Cleared global active_network setting. Result:", deleteResult);
            } else {
                console.log("User is NOT admin, skipping active_network clear.");
            }

            console.log(`Wallet unlinked for user ${user._id}`);

            await logAudit({
                userId: user._id,
                action: 'UNLINK_WALLET',
                details: `Wallet unlinked for user ${dbUser.email}`,
                resourceType: 'User',
                resourceId: user._id,
                ipAddress: req.ip,
                changes: { walletAddress: { old: oldWallet, new: 'PENDING...' } }
            });

            res.json({ message: 'Wallet unlinked successfully' });
        } else {
            console.log("User not found in DB");
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error: any) {
        console.error("Unlink Wallet Exception:", error);
        res.status(500).json({ message: process.env.NODE_ENV === 'production' ? 'Server Error' : error.message });
    }
}

// @desc    Auth user with wallet (LEGACY - KEEPING FOR REF OR ALTERNATIVE LOGIN)
// @route   POST /api/auth/wallet
// @access  Public
export const authWallet = async (req: Request, res: Response) => {
    const { walletAddress, signature, message } = req.body;

    try {
        let user: any = await User.findOne({ walletAddress }).populate('role');

        if (!user) {
            const userRole = await Role.findOne({ name: 'user' });
            if (!userRole) throw new Error('Role not found');

            const referralCode = crypto.randomBytes(4).toString('hex');
            user = await User.create({
                walletAddress,
                referralCode,
                role: userRole._id,
            });
            await user.populate('role');
        }

        res.json({
            _id: user._id,
            walletAddress: user.walletAddress,
            role: user.role.name, // Send role name to client
            username: user.username,
            email: user.email,
            phoneNumber: user.phoneNumber,
            dateOfBirth: user.dateOfBirth,
            zipCode: user.zipCode,
            country: user.country,
            referralCode: user.referralCode,
            token: generateToken((user._id as unknown) as string),
        });
    } catch (error: any) {
        res.status(500).json({ message: process.env.NODE_ENV === 'production' ? 'Server Error' : error.message });
    }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user._id;
        const user: any = await User.findById(userId).populate('role');

        if (user) {
            res.json({
                _id: user._id,
                username: user.username,
                email: user.email,
                phoneNumber: user.phoneNumber,
                dateOfBirth: user.dateOfBirth,
                zipCode: user.zipCode,
                country: user.country,
                walletAddress: user.walletAddress,
                role: user.role.name,
                isActive: user.isActive,
                isEmailVerified: user.isEmailVerified,
                referralCode: user.referralCode,
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error: any) {
        res.status(500).json({ message: process.env.NODE_ENV === 'production' ? 'Server Error' : error.message });
    }
};

// @desc    Register Admin (Seeding purpose)
// @route   POST /api/auth/admin-register
export const registerAdmin = async (req: Request, res: Response) => {
    const { email, password, secret } = req.body;

    // Strict Secret Check
    if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
        // Use a generic message to avoid leaking that the secret verification failed vs endpoint existing
        return res.status(403).json({ message: 'Forbidden: Invalid Authorization' });
    }

    try {
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const adminRole = await Role.findOne({ name: 'admin' });
        if (!adminRole) throw new Error('Admin role not found');

        // Explicitly hash password for admin security
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = await User.create({
            walletAddress: 'ADMIN_' + crypto.randomBytes(4).toString('hex'), // Admin might not have wallet initially
            email,
            password: hashedPassword, // Explicitly hashed
            role: adminRole._id,
            referralCode: 'ADMIN'
        });
        await user.populate('role');

        res.status(201).json({
            _id: user._id,
            email: user.email,
            role: (user.role as any).name,
            token: generateToken((user._id as unknown) as string),
        });

    } catch (error: any) {
        res.status(500).json({ message: process.env.NODE_ENV === 'production' ? 'Server Error' : error.message });
    }
}

// @desc    Get Admin Wallet Address
// @route   GET /api/auth/admin-wallet
// @access  Public
export const getAdminWallet = async (req: Request, res: Response) => {
    try {
        const adminRole = await Role.findOne({ name: 'admin' });
        if (!adminRole) {
            return res.status(500).json({ message: 'Admin role configuration missing' });
        }

        const adminUser = await User.findOne({ role: adminRole._id }).select('walletAddress');

        if (!adminUser) {
            // Fallback for initial seed state if needed, or specific error
            return res.status(404).json({ message: 'Admin wallet not found' });
        }

        res.json({ walletAddress: adminUser.walletAddress });
    } catch (error: any) {
        res.status(500).json({ message: process.env.NODE_ENV === 'production' ? 'Server Error' : error.message });
    }
};
// @desc    Logout user / Clear session (Audit purpose)
// @route   POST /api/auth/logout
// @access  Private
export const logoutUser = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user._id;

        await logAudit({
            userId: userId.toString(),
            action: 'LOGOUT',
            details: 'User logged out',
            ipAddress: req.ip,
            resourceType: 'User',
            resourceId: userId.toString(),
        });

        res.json({ message: 'Logged out successfully' });
    } catch (error: any) {
        // Even if logging fails, we don't want to stop the client from logging out
        console.error("Logout audit failed", error);
        res.status(200).json({ message: 'Logged out' });
    }
};

// @desc    Verify email
// @route   POST /api/auth/verify-email
// @access  Public
export const verifyEmail = async (req: Request, res: Response) => {
    const { token } = req.body;

    try {
        const user = await User.findOne({
            emailVerificationToken: token,
            emailVerificationExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired verification token' });
        }

        user.isEmailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        await user.save();

        res.json({
            message: 'Email verified successfully',
            token: generateToken((user._id as unknown) as string),
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                role: (user.role as any).name,
                referralCode: user.referralCode
            }
        });
    } catch (error: any) {
        res.status(500).json({ message: process.env.NODE_ENV === 'production' ? 'Server Error' : error.message });
    }
};

// @desc    Resend Verification Email
// @route   POST /api/auth/resend-verification
// @access  Public
export const resendVerificationEmail = async (req: Request, res: Response) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.isEmailVerified) {
            return res.status(400).json({ message: 'Email is already verified' });
        }

        // Generate new token
        user.emailVerificationToken = crypto.randomBytes(32).toString('hex');
        user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        await user.save();

        await sendVerificationEmail(user.email!, user.emailVerificationToken);

        res.json({ message: 'Verification email sent successfully' });

    } catch (error: any) {
        res.status(500).json({ message: process.env.NODE_ENV === 'production' ? 'Server Error' : error.message });
    }
};

// @desc    Forgot Password - Request Reset Link
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req: Request, res: Response) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Generate Reset Token
        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 Hour

        await user.save();

        await sendPasswordResetEmail(user.email!, resetToken);

        res.json({ message: 'Password reset email sent' });
    } catch (error: any) {
        res.status(500).json({ message: process.env.NODE_ENV === 'production' ? 'Server Error' : error.message });
    }
};

// @desc    Reset Password
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = async (req: Request, res: Response) => {
    const { token, password } = req.body;

    try {
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired token' });
        }

        user.password = password; // Will be hashed in pre-save hook
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        await logAudit({
            userId: user._id.toString(),
            action: 'RESET_PASSWORD',
            details: 'User reset their password via email',
            ipAddress: req.ip,
            resourceType: 'User',
            resourceId: user._id.toString(),
        });

        await notifyUser(user._id.toString(), 'Password Changed', `Your password was successfully reset.`);

        res.json({ message: 'Password reset successful' });
    } catch (error: any) {
        res.status(500).json({ message: process.env.NODE_ENV === 'production' ? 'Server Error' : error.message });
    }
};
// @desc    Change Password
// @route   POST /api/auth/change-password
// @access  Private
export const changePassword = async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    const userId = (req as any).user._id;

    try {
        const user: any = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check current password
        if (!(await user.matchPassword(currentPassword))) {
            return res.status(400).json({ message: 'Invalid current password' });
        }

        // Update password
        user.password = newPassword; // Will be hashed by pre-save hook
        await user.save();

        await logAudit({
            userId: user._id.toString(),
            action: 'CHANGE_PASSWORD',
            details: 'User changed their password',
            ipAddress: req.ip,
            resourceType: 'User',
            resourceId: user._id.toString(),
        });

        await notifyUser(user._id.toString(), 'Password Changed', `Your password was successfully changed.`);

        res.json({ message: 'Password changed successfully' });
    } catch (error: any) {
        res.status(500).json({ message: process.env.NODE_ENV === 'production' ? 'Server Error' : error.message });
    }
};
