import { AuditLog } from '../models/index.js';

export async function getAuditLogs(req, res, next) {
  try {
    const { entityType, entityId, limit = 50 } = req.query;

    const where = {};
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;

    const logs = await AuditLog.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit, 10)
    });

    res.json(logs);
  } catch (err) {
    next(err);
  }
}
