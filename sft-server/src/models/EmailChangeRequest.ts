import mongoose, { Schema, Document } from 'mongoose';

export interface IEmailChangeRequest extends Document {
    user: mongoose.Types.ObjectId;
    oldEmail: string;
    newEmail: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
    verificationToken?: string;
    verificationExpires?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const EmailChangeRequestSchema: Schema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    oldEmail: { type: String, required: true },
    newEmail: { type: String, required: true },
    verificationToken: { type: String },
    verificationExpires: { type: Date },
    status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'],
        default: 'PENDING'
    }
}, { timestamps: true });

export default mongoose.model<IEmailChangeRequest>('EmailChangeRequest', EmailChangeRequestSchema);
