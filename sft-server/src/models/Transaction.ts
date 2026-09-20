import mongoose, { Schema, Document } from 'mongoose';
import { isTxHashUnique } from '../services/validationService';

export interface ITransaction extends Document {
    user: mongoose.Types.ObjectId;
    plan?: mongoose.Types.ObjectId;
    investment?: mongoose.Types.ObjectId; // Link to active investment
    swapRequest?: mongoose.Types.ObjectId; // Link to swap request
    type: 'PURCHASE' | 'MATURITY_PAYOUT' | 'REFERRAL_REWARD' | 'WITHDRAWAL' | 'SFT_TRANSFER' | 'ROI' | 'LEVEL_INCOME' | 'MATCHING_INCOME' | 'TRANSFER' | 'SWAP';
    sourceType?: 'ROI' | 'REFERRAL' | 'LEVEL' | 'MATCHING';
    amountSFT: number;
    amountSFTAllocated?: number;
    fee?: number;
    txHash?: string; // Blockchain transaction hash
    status: 'PENDING' | 'APPROVED' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'REJECTED' | 'SKIPPED';
    maturityDate?: Date; // For locked investments
    notes?: string;
}

const TransactionSchema: Schema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    plan: { type: Schema.Types.ObjectId, ref: 'InvestmentPlan' },
    investment: { type: Schema.Types.ObjectId, ref: 'Investment' },
    swapRequest: { type: Schema.Types.ObjectId, ref: 'SwapRequest' },
    type: { type: String, enum: ['PURCHASE', 'MATURITY_PAYOUT', 'REFERRAL_REWARD', 'WITHDRAWAL', 'SFT_TRANSFER', 'ROI', 'LEVEL_INCOME', 'MATCHING_INCOME', 'TRANSFER', 'SWAP'], required: true },
    sourceType: { type: String, enum: ['ROI', 'REFERRAL', 'LEVEL', 'MATCHING'] }, // For TRANSFER transactions
    amountSFT: { type: Number, required: true },
    amountSFTAllocated: { type: Number },
    fee: { type: Number }, // Withdrawal fee
    txHash: { type: String, unique: true, sparse: true },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'COMPLETED', 'FAILED', 'CANCELLED', 'REJECTED', 'SKIPPED'], default: 'PENDING' },
    maturityDate: { type: Date },
    notes: { type: String },
}, { timestamps: true });

TransactionSchema.pre('save', async function () {
    if (this.isModified('txHash') && this.txHash) {
        // Check uniqueness excluding self and potentially parent investment which shares the hash
        const txHashVal = this.txHash as string;
        const exclusions: string[] = [];

        if (this._id) exclusions.push((this._id as any).toString());
        if (this.investment) exclusions.push((this.investment as any).toString());
        if (this.swapRequest) exclusions.push((this.swapRequest as any).toString());

        const isUnique = await isTxHashUnique(txHashVal, exclusions);
        if (!isUnique) {
            throw new Error('Transaction hash already exists in the system.');
        }
    }
});

export default mongoose.model<ITransaction>('Transaction', TransactionSchema);
