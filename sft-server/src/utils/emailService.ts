import nodemailer from 'nodemailer';

// Helper to create transporter with Brevo settings
export const getTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.BREVO_HOST || 'smtp-relay.brevo.com',
        port: Number(process.env.BREVO_PORT) || 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.BREVO_USER,
            pass: process.env.BREVO_PASS,
        },
    });
};

const sendVerificationEmail = async (to: string, token: string) => {
    try {
        console.log('Attempting to send verification email via Brevo...');

        const transporter = getTransporter();
        const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${token}`;
        const fromEmail = process.env.EMAIL_FROM || process.env.BREVO_USER || 'noreply@example.com';

        const mailOptions = {
            from: fromEmail,
            to,
            subject: 'Verify Your Email Address',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Welcome to Secure Financial Platform!</h2>
                    <p>Please click the link below to verify your email address and activate your account:</p>
                    <a href="${verificationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Verify Email</a>
                    <p>Or copy and paste this link into your browser:</p>
                    <p>${verificationUrl}</p>
                    <p>This link will expire in 24 hours.</p>
                </div>
            `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`Verification email sent to ${to}`);
    } catch (error) {
        console.error('Error sending verification email:', error);
        throw new Error('Email functionality is currently unavailable');
    }
};

export const sendPasswordResetEmail = async (to: string, token: string) => {
    try {
        console.log('Attempting to send password reset email via Brevo...');

        const transporter = getTransporter();
        const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
        const fromEmail = process.env.EMAIL_FROM || process.env.BREVO_USER || 'noreply@example.com';

        const mailOptions = {
            from: fromEmail,
            to,
            subject: 'Password Reset Request',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Password Reset Request</h2>
                    <p>You requested a password reset. Please click the link below to reset your password:</p>
                    <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
                    <p>Or copy and paste this link into your browser:</p>
                    <p>${resetUrl}</p>
                    <p>This link will expire in 1 hour.</p>
                </div>
            `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`Password reset email sent to ${to}`);
    } catch (error) {
        console.error('Error sending password reset email:', error);
        throw new Error('Email functionality is currently unavailable');
    }
};

export const sendOtpEmail = async (to: string, otp: string) => {
    try {
        console.log('Attempting to send OTP email via Brevo...');

        const transporter = getTransporter();
        const fromEmail = process.env.EMAIL_FROM || process.env.BREVO_USER || 'noreply@example.com';

        const mailOptions = {
            from: fromEmail,
            to,
            subject: 'Login OTP Verification',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Admin 2FA Verification</h2>
                    <p>Your OTP code for login is:</p>
                    <h1 style="background-color: #f4f4f4; padding: 10px; border-radius: 5px; text-align: center; letter-spacing: 5px;">${otp}</h1>
                    <p>This code will expire in 5 minutes.</p>
                </div>
            `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`OTP email sent to ${to}`);
    } catch (error) {
        console.error('Error sending OTP email:', error);
        throw new Error('Email functionality is currently unavailable');
    }
};

export const sendEmailChangeVerification = async (to: string, token: string) => {
    try {
        console.log('Attempting to send email change verification via Brevo...');

        const transporter = getTransporter();
        const verificationUrl = `${process.env.CLIENT_URL}/verify-email-change?token=${token}`;
        const fromEmail = process.env.EMAIL_FROM || process.env.BREVO_USER || 'noreply@example.com';

        const mailOptions = {
            from: fromEmail,
            to,
            subject: 'Verify Your New Email Address',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Verify Your New Email Address</h2>
                    <p>You have requested to change your email address. Please click the link below to verify this new email:</p>
                    <a href="${verificationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Verify New Email</a>
                    <p>Or copy and paste this link into your browser:</p>
                    <p>${verificationUrl}</p>
                    <p>This link will expire in 24 hours.</p>
                </div>
            `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`Email change verification sent to ${to}`);
    } catch (error) {
        console.error('Error sending email change verification:', error);
        throw new Error('Email functionality is currently unavailable');
    }
};

export default sendVerificationEmail;
