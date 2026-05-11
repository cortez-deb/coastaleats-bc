import { Queue } from 'bullmq';
import redisClient from '../config/redis.js';

export const swapQueue = new Queue('swapQueue', {
  connection: redisClient,
});
