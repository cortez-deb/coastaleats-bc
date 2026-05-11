import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

router.post('/register', [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['admin', 'manager', 'staff']).withMessage('Invalid role'),
  body('skills').optional().isArray(),
  body('locations').optional().isArray(),
  validate
], authController.register);

router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  validate
], authController.login);

router.post('/refresh', [
  body('refreshToken').notEmpty().withMessage('Refresh token is required'),
  validate
], authController.refresh);

router.post('/logout', [
  body('refreshToken').notEmpty().withMessage('Refresh token is required'),
  validate
], authController.logout);

export default router;
