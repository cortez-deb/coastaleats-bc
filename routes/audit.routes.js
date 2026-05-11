import { Router } from 'express';
import { query } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import * as auditController from '../controllers/audit.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', [
  requireRole('admin', 'manager'),
  query('entityType').optional().isString(),
  query('entityId').optional().isUUID(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validate
], auditController.getAuditLogs);

export default router;
