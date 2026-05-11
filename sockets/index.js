import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import { User, ManagerLocation, UserLocation } from '../models/index.js';

let ioInstance = null;

export function initSocket(httpServer, redisClient) {
  const io = new Server(httpServer, {
    cors: {
      origin: '*', // Adjust as needed for production
      methods: ['GET', 'POST']
    }
  });

  const pubClient = redisClient.duplicate();
  const subClient = redisClient.duplicate();

  io.adapter(createAdapter(pubClient, subClient));

  io.on('connection', (socket) => {
    // Disconnect if no auth within 5 seconds
    const authTimeout = setTimeout(() => {
      socket.disconnect(true);
    }, 5000);

    socket.on('authenticate', async (payload) => {
      try {
        const { token } = payload;
        if (!token) throw new Error('No token provided');

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findByPk(decoded.userId);
        
        if (!user) throw new Error('User not found');

        clearTimeout(authTimeout);

        // Join rooms
        socket.join(`user:${user.id}`);

        if (user.role === 'admin') {
          socket.join('admin');
        }

        if (user.role === 'manager') {
          const managedLocs = await ManagerLocation.findAll({ where: { userId: user.id } });
          for (const ml of managedLocs) {
            socket.join(`location:${ml.locationId}`);
          }
        }

        if (user.role === 'staff') {
          const certLocs = await UserLocation.findAll({ where: { userId: user.id } });
          for (const cl of certLocs) {
            socket.join(`location:${cl.locationId}`);
          }
        }

        socket.emit('authenticated', { success: true });
        
      } catch (err) {
        socket.emit('unauthorized', { message: 'Authentication failed' });
        socket.disconnect(true);
      }
    });
  });

  ioInstance = io;
  return io;
}

export function getIO() {
  if (!ioInstance) {
    throw new Error('Socket.IO not initialized');
  }
  return ioInstance;
}
