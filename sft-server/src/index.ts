// Server Entry Point
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();

app.use(express.json());
// Middleware
app.use(morgan('dev'));

// CORS Configuration
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 1000, // Limit each IP to 1000 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use(limiter);
app.use(helmet({
    crossOriginResourcePolicy: {
        policy: 'cross-origin'
    }
}));

// Routes Placeholder
app.get('/', (req, res) => {
    res.send('SFT API is running');
});

import authRoutes from './routes/authRoutes';
import planRoutes from './routes/planRoutes';
import investmentRoutes from './routes/investmentRoutes';
import settingsRoutes from './routes/settingsRoutes';
import referralRoutes from './routes/referralRoutes';
import earningsRoutes from './routes/earningsRoutes'; // Added earningsRoutes import
import swapRoutes from './routes/swapRoutes';
import userRoutes from './routes/userRoutes';

app.use('/api/auth', authRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/investments', investmentRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/earnings', earningsRoutes); // Added earningsRoutes usage
app.use('/api/swaps', swapRoutes);
app.use('/api/users', userRoutes);
import auditRoutes from './routes/auditRoutes';
app.use('/api/audit-logs', auditRoutes);
import dashboardRoutes from './routes/dashboardRoutes';
app.use('/api/admin', dashboardRoutes);

import notificationRoutes from './routes/notificationRoutes';
app.use('/api/notifications', notificationRoutes);

import emailChangeRoutes from './routes/emailChangeRoutes';
app.use('/api/email-change', emailChangeRoutes);

import { notFound, errorHandler } from './middlewares/errorMiddleware';
app.use(notFound);
app.use(errorHandler);

// Database Connection
connectDB();

import { processDailyROI } from './cron';
processDailyROI();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
