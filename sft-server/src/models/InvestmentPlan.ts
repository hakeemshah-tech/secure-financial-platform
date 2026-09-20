import mongoose, { Schema, Document } from 'mongoose';

export interface IInvestmentPlan extends Document {
    name: string;
    description?: string;
    lockInPeriodDays: number;
    sftPrice: number; // Price of 1 SFT in USDT for this plan
    minInvestmentSFT: number;
    roiPercent: number; // Return on Investment percentage
    isActive: boolean;
    isDeleted: boolean;
    walletAddress: string; // Admin wallet address for this plan
}

const InvestmentPlanSchema: Schema = new Schema({
    name: { type: String, required: true },
    description: { type: String },
    lockInPeriodDays: { type: Number, required: true },
    sftPrice: { type: Number, required: true },
    minInvestmentSFT: { type: Number, required: true },
    roiPercent: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    walletAddress: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model<IInvestmentPlan>('InvestmentPlan', InvestmentPlanSchema);
