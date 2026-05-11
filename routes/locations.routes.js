import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import * as locationsController from '../controllers/locations.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', locationsController.getLocations);

router.post('/', [
  requireRole('admin'),
  body('name').notEmpty().withMessage('Name is required'),
  body('timezone').notEmpty().withMessage('Timezone is required'),
  body('address').optional().isString(),
  validate
], locationsController.createLocation);

router.get('/:id', locationsController.getLocation);

router.patch('/:id', [
  requireRole('admin'),
  body('name').optional().notEmpty(),
  body('timezone').optional().notEmpty(),
  body('address').optional().isString(),
  validate
], locationsController.updateLocation);

router.get('/:id/roster', [
  requireRole('admin', 'manager')
], locationsController.getRoster);

router.post('/bulk-cutoff', [
  requireRole('admin'),
  body('cutoffHours').isNumeric(),
  validate
], locationsController.bulkUpdateCutoff);

router.delete('/:id', [
  requireRole('admin')
], locationsController.deleteLocation);

export default router;
