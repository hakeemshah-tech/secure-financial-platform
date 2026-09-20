import { Request, Response } from 'express';
import EmailChangeRequest from '../models/EmailChangeRequest';
import User from '../models/User';
import crypto from 'crypto';
import sendVerificationEmail, { sendEmailChangeVerification } from '../utils/emailService';
import { generateToken } from './authController'; // Reuse token generation

export const requestEmailChange = async (req: Request, res: Response) => {
    try {
        const { oldEmail, newEmail } = req.body;

        if (!oldEmail || !newEmail) {
            return res.status(400).json({ message: 'Old email and new email are required' });
        }

        const user: any = await User.findOne({ email: oldEmail });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Removed password check as requested
        // if (!(await user.matchPassword(password))) {
        //     return res.status(401).json({ message: 'Invalid password' });
        // }

        // Removed isEmailVerified check to allow everyone to change email
        // if (user.isEmailVerified) {
        //     return res.status(400).json({ message: 'Only unverified users can request email change' });
        // }

        // Check if new email is already taken
        const existingUser = await User.findOne({ email: newEmail });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already in use' });
        }

        // Create request
        const request = await EmailChangeRequest.create({
            user: user._id,
            oldEmail: user.email,
            newEmail,
            status: 'PENDING'
        });

        res.status(201).json({ message: 'Email change request submitted', request });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getEmailChangeRequests = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        const requests = await EmailChangeRequest.find()
            .populate('user', 'username email walletAddress isEmailVerified')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await EmailChangeRequest.countDocuments();

        res.status(200).json({
            requests,
            pagination: {
                page,
                pages: Math.ceil(total / limit),
                total
            }
        });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const approveEmailChange = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const request = await EmailChangeRequest.findById(id).populate('user');

        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        if (request.status !== 'PENDING') {
            return res.status(400).json({ message: 'Request is not pending' });
        }

        const user = await User.findById(request.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Generate verification token for the NEW email
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Update Request with verification token
        request.status = 'APPROVED';
        request.verificationToken = verificationToken;
        request.verificationExpires = verificationExpires;
        await request.save();

        // Send verification email to the NEW email address
        // await sendEmailChangeVerification(request.newEmail, verificationToken);

        res.status(200).json({ message: 'Request approved. Status updated.', request });

    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const verifyEmailChange = async (req: Request, res: Response) => {
    const { token } = req.body;

    try {
        const request = await EmailChangeRequest.findOne({
            verificationToken: token,
            verificationExpires: { $gt: Date.now() },
            status: 'APPROVED'
        }).populate('user');

        if (!request) {
            return res.status(400).json({ message: 'Invalid or expired verification token' });
        }

        const user: any = await User.findById(request.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if new email is still available (double check)
        const existingUser = await User.findOne({ email: request.newEmail });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already in use by another account' });
        }

        // Update User Email
        user.email = request.newEmail;
        user.isEmailVerified = true; // Mark as verified since they just verified it
        await user.save();

        // Update Request Status
        request.status = 'COMPLETED';
        request.verificationToken = undefined;
        request.verificationExpires = undefined;
        await request.save();

        // Expire other pending requests for this user?
        // Optional: Close other pending requests
        await EmailChangeRequest.updateMany(
            { user: user._id, status: 'PENDING' },
            { status: 'REJECTED' }
        );

        res.json({
            message: 'Email changed successfully',
            token: generateToken((user._id as unknown) as string),
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                role: (user.role as any).name,
                isEmailVerified: user.isEmailVerified
            }
        });

    } catch (error: any) {
        res.status(500).json({ message: process.env.NODE_ENV === 'production' ? 'Server Error' : error.message });
    }
};

export const rejectEmailChange = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const request = await EmailChangeRequest.findById(id);

        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        // Batch reject all pending requests for this user and this new email
        // We use the request details to find duplicates
        await EmailChangeRequest.updateMany(
            {
                user: request.user, // schema uses user ID
                newEmail: request.newEmail,
                status: 'PENDING'
            },
            { status: 'REJECTED' }
        );

        res.status(200).json({ message: 'Email change request(s) rejected' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const resendVerificationEmailAction = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const request = await EmailChangeRequest.findById(id).populate('user');

        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        if (request.status !== 'APPROVED') {
            return res.status(400).json({ message: 'Request must be approved to resend verification' });
        }

        // Logic to send Verification Email for Email Change
        if (request.verificationToken) {
            await sendEmailChangeVerification(request.newEmail, request.verificationToken);
            res.status(200).json({ message: 'Verification email sent successfully to ' + request.newEmail });
            return;
        }

        // Fallback or Error if no token exists (Should be there if Approved)
        res.status(500).json({ message: 'Verification token missing on approved request.' });

    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
