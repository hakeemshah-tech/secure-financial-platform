import mongoose, { Schema, Document } from 'mongoose';
import { isTxHashUnique } from '../services/validationService';

export interface ISwapRequest extends Document {
    user: mongoose.Types.ObjectId;
    walletAddress: string; // The user's wallet address
    amount: number;
    fromToken: 'SFT' | 'USDT';
    toToken: 'USDT' | 'SFT';
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';
    userTxHash?: string; // Hash when user sends tokens to admin
    adminTxHash?: string; // Hash when admin sends tokens to user
    createdAt: Date;
    updatedAt: Date;
}

const SwapRequestSchema: Schema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    walletAddress: { type: String, required: true },
    amount: { type: Number, required: true },
    fromToken: { type: String, enum: ['SFT', 'USDT'], required: true },
    toToken: { type: String, enum: ['USDT', 'SFT'], required: true },
    status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED'],
        default: 'PENDING'
    },
    userTxHash: { type: String, unique: true, sparse: true },
    adminTxHash: { type: String, unique: true, sparse: true }
}, { timestamps: true });

SwapRequestSchema.pre('save', async function () {
    if (this.isModified('userTxHash') && this.userTxHash) {
        const userTxHashVal = this.userTxHash as string;
        const exclusions = this._id ? [(this._id as any).toString()] : [];
        const isUnique = await isTxHashUnique(userTxHashVal, exclusions);
        if (!isUnique) throw new Error('Transaction hash (userTxHash) already exists in the system.');
    }
    if (this.isModified('adminTxHash') && this.adminTxHash) {
        const adminTxHashVal = this.adminTxHash as string;
        const exclusions = this._id ? [(this._id as any).toString()] : [];
        const isUnique = await isTxHashUnique(adminTxHashVal, exclusions);
        if (!isUnique) throw new Error('Transaction hash (adminTxHash) already exists in the system.');
    }
});

export default mongoose.model<ISwapRequest>('SwapRequest', SwapRequestSchema);
