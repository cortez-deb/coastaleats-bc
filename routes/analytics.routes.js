import { Router } from 'express';
import { query } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import * as analyticsController from '../controllers/analytics.controller.js';

const router = Router();

router.use(authenticate);

router.get('/dashboard', [
  requireRole('admin', 'manager'),
  query('locationId').optional().isUUID(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  validate
], analyticsController.getDashboardStats);

export default router;
