import http from 'http';
import app from './app.js';
import { initSocket } from './sockets/index.js';
import redisClient from './config/redis.js';
import { startWorkers } from './jobs/workers.js';
import { sequelize } from './models/index.js';

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);

// Initialize Socket.IO
const io = initSocket(server, redisClient);

// Start BullMQ workers
startWorkers(io);

// Test database connection and sync if necessary, then listen
sequelize.authenticate()
  .then(() => {
    console.log('Database connection has been established successfully.');
    server.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });
