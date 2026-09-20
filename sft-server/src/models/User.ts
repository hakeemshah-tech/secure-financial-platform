import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcrypt';

export interface IUser extends Document {
    walletAddress: string;
    username: string; // New field
    email?: string;
    fcmToken?: string; // Firebase Cloud Messaging Token
    phoneNumber?: string; // New field
    dateOfBirth?: Date; // New field
    zipCode?: string; // New field
    country?: string; // New field
    otp?: string; // 2FA OTP
    otpExpires?: Date; // 2FA OTP Expiry
    password?: string;
    role: mongoose.Types.ObjectId; // Reference to Role
    leftVolume: number; // Volume on left leg
    rightVolume: number; // Volume on right leg
    levelVolumes: {
        level: number;
        left: number;
        right: number;
        matched: number;
    }[]; // New field for Level-based Binary
    totalMatchingIncome: number; // Total matching income earned

    // Income Cap Fields
    maxIncomeLimit: number; // Total allowable income (Cumulative from all investments)
    totalEarnedIncome: number; // Total income earned so far (ROI + Referral + Level + Matching)
    totalWithdrawn: number;

    isActive: boolean; // Active status based on investment
    isBlocked: boolean; // New field
    isEmailVerified: boolean;
    emailVerificationToken?: string;
    emailVerificationExpires?: Date;
    referralCode: string;
    resetPasswordToken?: string;
    resetPasswordExpires?: Date;
    referrer?: mongoose.Types.ObjectId;
    isPlacedInTree: boolean;
    placementParent?: mongoose.Types.ObjectId;
    leftChild?: mongoose.Types.ObjectId;
    rightChild?: mongoose.Types.ObjectId;
    placementPreference: 'auto' | 'left' | 'right'; // New field for placement strategy

    // Global Binary Matching Fields
    totalMatched: number;
    leftCount: number;
    rightCount: number;
    leftActiveCount: number;
    rightActiveCount: number;

    createdAt: Date;
    matchPassword(enteredPassword: string): Promise<boolean>;
}

const UserSchema: Schema = new Schema({
    walletAddress: { type: String, required: true, unique: true },
    username: { type: String, unique: true }, // New field
    phoneNumber: { type: String }, // New field
    dateOfBirth: { type: Date }, // New field
    zipCode: { type: String }, // New field
    country: { type: String }, // New field
    otp: { type: String },
    otpExpires: { type: Date },
    fcmToken: { type: String }, // Firebase Cloud Messaging Token
    email: { type: String, unique: true, sparse: true },
    password: { type: String },
    role: { type: Schema.Types.ObjectId, ref: 'Role', required: true },
    leftVolume: { type: Number, default: 0 },
    rightVolume: { type: Number, default: 0 },
    levelVolumes: [{
        level: Number,
        left: { type: Number, default: 0 },
        right: { type: Number, default: 0 },
        matched: { type: Number, default: 0 },
        leftCount: { type: Number, default: 0 },
        rightCount: { type: Number, default: 0 }
    }],
    totalMatchingIncome: { type: Number, default: 0 },

    // Income Cap Fields
    maxIncomeLimit: { type: Number, default: 0 },
    totalEarnedIncome: { type: Number, default: 0 },
    totalWithdrawn: { type: Number, default: 0 },

    isActive: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false }, // New field for blocking users
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String },
    emailVerificationExpires: { type: Date },
    referralCode: { type: String, unique: true },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    referrer: { type: Schema.Types.ObjectId, ref: 'User' },
    isPlacedInTree: { type: Boolean, default: false },
    placementParent: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    leftChild: { type: Schema.Types.ObjectId, ref: 'User' },
    rightChild: { type: Schema.Types.ObjectId, ref: 'User' },
    placementPreference: { type: String, enum: ['auto', 'left', 'right'], default: 'auto' },

    // Global Binary Matching Fields
    totalMatched: { type: Number, default: 0 },
    leftCount: { type: Number, default: 0 },
    rightCount: { type: Number, default: 0 },
    leftActiveCount: { type: Number, default: 0 },
    rightActiveCount: { type: Number, default: 0 }
}, { timestamps: true });

UserSchema.pre('save', async function (this: IUser) {
    if (!this.isModified('password') || !this.password) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

UserSchema.methods.matchPassword = async function (enteredPassword: string) {
    return await bcrypt.compare(enteredPassword, this.password || '');
};

export default mongoose.model<IUser>('User', UserSchema);
