import { sequelize } from './models/index.js';

async function check() {
  try {
    const [results] = await sequelize.query("SELECT name FROM sqlite_master WHERE type='table' AND name='LeaveRequests'");
    console.log('Table LeaveRequests exists:', results.length > 0);
  } catch (err) {
    // If it's postgres
    try {
      const [results] = await sequelize.query("SELECT table_name FROM information_schema.tables WHERE table_name='LeaveRequests'");
      console.log('Table LeaveRequests exists:', results.length > 0);
    } catch (pgErr) {
      console.error('Error checking table:', pgErr.message);
    }
  }
  process.exit(0);
}

check();
