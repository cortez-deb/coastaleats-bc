import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null, // Required by bullmq
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error', err);
});

export default redisClient;
