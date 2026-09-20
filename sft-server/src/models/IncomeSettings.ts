import mongoose, { Schema, Document } from 'mongoose';

export interface IIncomeSettings extends Document {
    referralIncome: number;
    matchingIncome: number;
    levelIncome: number[];
    minWithdrawal: number;
    withdrawalFee: number;
    maxIncomeMultiplier: number; // Global limit multiplier (e.g., 2 or 3)
}

const IncomeSettingsSchema: Schema = new Schema({
    referralIncome: { type: Number, required: true, default: 0 },
    matchingIncome: { type: Number, required: true, default: 0 },
    levelIncome: { type: [Number], default: [] },
    minWithdrawal: { type: Number, default: 0 },
    withdrawalFee: { type: Number, default: 0 },
    maxIncomeMultiplier: { type: Number, default: 2 } // Default 2x as requested
}, { timestamps: true });

// Ensure only one document exists, or just manage it via logic (singleton pattern often handled by controller upsert)
export default mongoose.model<IIncomeSettings>('IncomeSettings', IncomeSettingsSchema);
