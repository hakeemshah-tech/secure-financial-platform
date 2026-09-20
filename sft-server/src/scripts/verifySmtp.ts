import dotenv from 'dotenv';
import { getTransporter } from '../utils/emailService';

// Load env vars
dotenv.config();

const verifyConnection = async () => {
    console.log('Testing SMTP Connection...');
    console.log(`Host: ${process.env.BREVO_HOST}`);
    console.log(`Port: ${process.env.BREVO_PORT}`);
    console.log(`User: ${process.env.BREVO_USER}`);

    try {
        const transporter = getTransporter();
        await transporter.verify();
        console.log('✅ Success! SMTP connection established and authenticated.');
    } catch (error) {
        console.error('❌ Failed to connect to SMTP server:', error);
        process.exit(1);
    }
};

verifyConnection();
