import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import * as skillsController from '../controllers/skills.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', skillsController.getSkills);

router.post('/', [
  requireRole('admin'),
  body('name').notEmpty().withMessage('Name is required'),
  validate
], skillsController.createSkill);

export default router;
