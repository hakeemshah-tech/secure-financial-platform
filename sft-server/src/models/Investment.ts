import mongoose, { Schema, Document } from 'mongoose';
import { isTxHashUnique } from '../services/validationService';

export interface IInvestment extends Document {
    user: mongoose.Types.ObjectId;
    plan: mongoose.Types.ObjectId;
    walletAddress: string;
    amountSFT: number;
    sftAllocated: number;
    startDate: Date;
    maturityDate: Date;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID' | 'COMPLETED' | 'CANCELLED' | 'WITHDRAW_REQUESTED' | 'WITHDRAW_APPROVED' | 'WITHDRAW_COMPLETED' | 'WITHDRAWAL_SUBMITTED';
    txHash?: string;
    sftTxHash?: string;
    requestType: 'INVESTMENT' | 'WITHDRAWAL';
    parentInvestment?: mongoose.Types.ObjectId;
    accumulatedROI: number;
    lastROIDate: Date;
    isVolumeDistributed?: boolean;
}

const InvestmentSchema: Schema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    plan: { type: Schema.Types.ObjectId, ref: 'InvestmentPlan', required: true },
    walletAddress: { type: String, required: true },
    amountSFT: { type: Number, required: true },
    sftAllocated: { type: Number, required: true },
    startDate: { type: Date, default: Date.now },
    maturityDate: { type: Date, required: true },
    status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED', 'PAID', 'COMPLETED', 'CANCELLED', 'WITHDRAW_REQUESTED', 'WITHDRAW_APPROVED', 'WITHDRAW_COMPLETED', 'WITHDRAWAL_SUBMITTED'],
        default: 'PENDING'
    },
    requestType: {
        type: String,
        enum: ['INVESTMENT', 'WITHDRAWAL'],
        default: 'INVESTMENT'
    },
    parentInvestment: { type: Schema.Types.ObjectId, ref: 'Investment', required: false },
    txHash: { type: String, required: false, unique: true, sparse: true }, // Blockchain transaction hash for the USDT payment
    sftTxHash: { type: String, required: false, unique: true, sparse: true }, // Blockchain transaction hash for the SFT transfer

    // ROI Tracking
    accumulatedROI: { type: Number, default: 0 },
    lastROIDate: { type: Date, default: Date.now },

    // Distribution Flag (To prevent double payment)
    isVolumeDistributed: { type: Boolean, default: false }
}, { timestamps: true });

InvestmentSchema.pre('save', async function () {
    // Validate txHash
    if (this.isModified('txHash') && this.txHash) {
        const txHashVal = this.txHash as string;
        const exclusions = this._id ? [(this._id as any).toString()] : [];
        const isUnique = await isTxHashUnique(txHashVal, exclusions);
        if (!isUnique) throw new Error('Transaction hash (txHash) already exists in the system.');
    }
    // Validate sftTxHash
    if (this.isModified('sftTxHash') && this.sftTxHash) {
        const sftTxHashVal = this.sftTxHash as string;
        const exclusions = this._id ? [(this._id as any).toString()] : [];
        const isUnique = await isTxHashUnique(sftTxHashVal, exclusions);
        if (!isUnique) throw new Error('Transaction hash (sftTxHash) already exists in the system.');
    }

    console.log('💾 Saving Investment (Pre-Save):', this.toObject());
});

export default mongoose.model<IInvestment>('Investment', InvestmentSchema);
// Updated Schema to include txHash
