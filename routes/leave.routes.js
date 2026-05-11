import express from 'express';
import * as leaveController from '../controllers/leave.controller.js';
import { authenticate, requireRole, requireSelfOrAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', leaveController.getAllLeaveRequests);
router.post('/', requireRole('staff'), leaveController.createLeaveRequest);
router.post('/:id/approve', requireRole('manager', 'admin'), leaveController.approveLeaveRequest);
router.post('/:id/reject', requireRole('manager', 'admin'), leaveController.rejectLeaveRequest);
router.post('/:id/cancel', requireRole('staff', 'admin'), leaveController.cancelLeaveRequest);

export default router;
