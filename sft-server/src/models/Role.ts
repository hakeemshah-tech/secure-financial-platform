import mongoose, { Schema, Document } from 'mongoose';

export interface IRole extends Document {
    name: string;
    description?: string;
    // Can add permissions or scopes here later
}

const RoleSchema: Schema = new Schema({
    name: { type: String, required: true, unique: true }, // e.g., 'user', 'admin'
    description: { type: String }
}, { timestamps: true });

export default mongoose.model<IRole>('Role', RoleSchema);
