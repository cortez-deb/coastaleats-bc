import { Router } from 'express';
import { body, query } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import * as swapsController from '../controllers/swaps.controller.js';

const router = Router();

router.use(authenticate);

router.post('/', [
  body('shiftId').isUUID(),
  body('targetId').optional().isUUID(),
  body('requesterNote').optional().isString(),
  validate
], swapsController.createSwap);

router.get('/', [
  query('status').optional().isIn(['PENDING_ACCEPT', 'PENDING_MANAGER', 'APPROVED', 'REJECTED', 'CANCELLED']),
  query('shiftId').optional().isUUID(),
  query('userId').optional().isUUID(),
  validate
], swapsController.getSwaps);

router.get('/:id', swapsController.getSwap);

router.patch('/:id/accept', swapsController.acceptSwap);

router.patch('/:id/approve', [
  requireRole('admin', 'manager')
], swapsController.approveSwap);

router.patch('/:id/reject', [
  requireRole('admin', 'manager')
], swapsController.rejectSwap);

router.patch('/:id/cancel', swapsController.cancelSwap);

export default router;
