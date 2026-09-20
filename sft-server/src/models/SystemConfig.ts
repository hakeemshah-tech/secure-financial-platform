import mongoose, { Schema, Document } from 'mongoose';

export interface ISystemConfig extends Document {
    key: string; // e.g., 'active_network'
    value: any;
}

const SystemConfigSchema: Schema = new Schema({
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true }
}, { timestamps: true });

export default mongoose.model<ISystemConfig>('SystemConfig', SystemConfigSchema);
