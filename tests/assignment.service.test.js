import { describe, test, expect, afterAll } from '@jest/globals';
import { checkConstraints } from '../services/assignment.service.js';
import { sequelize, User, Location, Skill, Shift, UserSkill, UserLocation } from '../models/index.js';

afterAll(async () => {
  await sequelize.close();
});

describe('Assignment Service - Constraint Checks', () => {
  test('existence', () => {
    expect(typeof checkConstraints).toBe('function');
  });
  
  test('should throw if shift not found', async () => {
    try {
      await checkConstraints('some-user-id', 'invalid-shift-id');
      throw new Error('Should have thrown');
    } catch (err) {
      expect(err.message).toMatch(/invalid input syntax/i);
    }
  });
});
