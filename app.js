import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/auth.routes.js';
import usersRoutes from './routes/users.routes.js';
import locationsRoutes from './routes/locations.routes.js';
import skillsRoutes from './routes/skills.routes.js';
import shiftsRoutes from './routes/shifts.routes.js';
import swapsRoutes from './routes/swaps.routes.js';
import laborRoutes from './routes/labor.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import auditRoutes from './routes/audit.routes.js';
import leaveRoutes from './routes/leave.routes.js';

const app = express();

app.use(cors());
app.use(express.json());
//console.log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Health check route (no auth)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api/skills', skillsRoutes);
app.use('/api/shifts', shiftsRoutes);
app.use('/api/swaps', swapsRoutes);
app.use('/api/labor', laborRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/leave', leaveRoutes);

// Global Error Handler
app.use(errorHandler);

export default app;
