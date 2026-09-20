import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
    user: mongoose.Types.ObjectId; // User who performed the action
    action: string; // What action was performed (e.g., LOGIN, UPDATE_PROFILE)
    details: string; // Human-readable description
    ipAddress?: string; // IP Address
    resourceType?: string; // The type of resource affected (e.g., User, Investment)
    resourceId?: string; // The ID of the resource
    changes?: any; // JSON object storing what changed (oldVal -> newVal)
    createdAt: Date;
}

const AuditLogSchema: Schema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    details: { type: String, required: true },
    ipAddress: { type: String },
    resourceType: { type: String },
    resourceId: { type: String },
    changes: { type: Schema.Types.Mixed }, // Flexible field for changes
}, { timestamps: true });

export default mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
