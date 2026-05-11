import { Notification } from '../models/index.js';

export async function getNotifications(req, res, next) {
  try {
    const notifications = await Notification.findAll({
      where: { userId: req.user.userId },
      order: [['createdAt', 'DESC']]
    });
    res.json(notifications);
  } catch (err) {
    next(err);
  }
}

export async function markAsRead(req, res, next) {
  try {
    const notification = await Notification.findOne({
      where: { id: req.params.id, userId: req.user.userId }
    });

    if (!notification) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Notification not found' });
    }

    notification.read = true;
    await notification.save();

    res.json(notification);
  } catch (err) {
    next(err);
  }
}

export async function markAllAsRead(req, res, next) {
  try {
    await Notification.update(
      { read: true },
      { where: { userId: req.user.userId, read: false } }
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
