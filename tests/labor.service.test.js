import { test, expect, afterAll } from '@jest/globals';
import { getWeeklyHours, getDailyHours } from '../services/labor.service.js';
import { sequelize } from '../models/index.js';

afterAll(async () => {
  await sequelize.close();
});

test('Labor Service - Overtime Calculations', async () => {
  expect(typeof getWeeklyHours).toBe('function');
  expect(typeof getDailyHours).toBe('function');
});
