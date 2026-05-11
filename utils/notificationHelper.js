import { Notification, User } from '../models/index.js';

export async function notify(userId, type, message, metadata = null, io = null) {
  try {
    const notification = await Notification.create({
      userId,
      type,
      message,
      metadata,
    });

    const user = await User.findByPk(userId);
    if (user && user.notifyEmail) {
      console.log(`[EMAIL] To: ${user.email} | ${type} | ${message}`);
    }

    if (io) {
      io.to(`user:${userId}`).emit('notification:new', {
        notificationId: notification.id,
        message,
        type,
        metadata
      });
    }

    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
}
