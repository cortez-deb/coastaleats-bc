import { Router } from 'express';
import { body, query } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import * as shiftsController from '../controllers/shifts.controller.js';

const router = Router();

router.use(authenticate);

router.post('/', [
  requireRole('admin', 'manager'),
  body('locationId').isUUID(),
  body('skillId').isUUID(),
  body('startUtc').isISO8601(),
  body('endUtc').isISO8601(),
  body('headcount').optional().isInt({ min: 1 }),
  validate
], shiftsController.createShift);

router.get('/', [
  query('locationId').optional().isUUID(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('published').optional().isBoolean(),
  validate
], shiftsController.getShifts);

router.get('/:id', shiftsController.getShift);

router.patch('/:id', [
  requireRole('admin', 'manager'),
  body('locationId').optional().isUUID(),
  body('skillId').optional().isUUID(),
  body('startUtc').optional().isISO8601(),
  body('endUtc').optional().isISO8601(),
  body('headcount').optional().isInt({ min: 1 }),
  body('notes').optional().isString(),
  validate
], shiftsController.updateShift);

router.delete('/:id', [
  requireRole('admin', 'manager')
], shiftsController.deleteShift);

router.post('/:id/publish', [
  requireRole('admin', 'manager')
], shiftsController.publishShift);

router.post('/:id/unpublish', [
  requireRole('admin', 'manager')
], shiftsController.unpublishShift);

router.get('/:id/history', [
  requireRole('admin', 'manager')
], shiftsController.getShiftHistory);

router.post('/:id/assignments', [
  requireRole('admin', 'manager'),
  body('userId').isUUID(),
  body('overrideReason').optional().isString(),
  validate
], shiftsController.createAssignment);

router.delete('/:id/assignments/:userId', [
  requireRole('admin', 'manager')
], shiftsController.deleteAssignment);

router.get('/:id/eligible', [
  requireRole('admin', 'manager')
], shiftsController.getEligibleStaff);

export default router;
