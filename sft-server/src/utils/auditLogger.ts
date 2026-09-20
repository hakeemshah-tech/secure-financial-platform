import AuditLog from '../models/AuditLog';

interface AuditLogParams {
    userId: string;
    action: string;
    details: string;
    ipAddress?: string;
    resourceType?: string;
    resourceId?: string;
    changes?: any;
}

export const logAudit = async (params: AuditLogParams) => {
    try {
        const { userId, action, details, ipAddress, resourceType, resourceId, changes } = params;

        await AuditLog.create({
            user: userId,
            action,
            details,
            ipAddress,
            resourceType,
            resourceId,
            changes
        });
    } catch (error) {
        console.error('Audit Log Error:', error);
        // We don't want to crash the request if logging fails, just log the error
    }
};
