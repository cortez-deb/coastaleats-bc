import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as notificationsController from '../controllers/notifications.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', notificationsController.getNotifications);
router.patch('/read-all', notificationsController.markAllAsRead);
router.patch('/:id/read', notificationsController.markAsRead);

export default router;
