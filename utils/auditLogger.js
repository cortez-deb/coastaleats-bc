import { AuditLog } from '../models/index.js';

export async function logAudit(actorId, entityType, entityId, action, before = null, after = null) {
  try {
    await AuditLog.create({
      actorId,
      entityType,
      entityId,
      action,
      before,
      after,
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}
