import { Router } from 'express';
import { query } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { authenticate, requireRole, requireSelfOrAdmin } from '../middleware/auth.js';
import * as laborController from '../controllers/labor.controller.js';

const router = Router();

router.use(authenticate);

router.get('/status/:userId', [
  requireSelfOrAdmin('userId'),
  query('date').optional().isISO8601(),
  validate
], laborController.getLaborStatus);

router.get('/evaluate', [
  requireRole('admin', 'manager'),
  query('userId').isUUID(),
  query('shiftId').isUUID(),
  validate
], laborController.evaluateShiftOvertime);

export default router;
