import * as leaveService from '../services/leave.service.js';
import { LeaveRequest, User } from '../models/index.js';
import { Op } from 'sequelize';

export async function createLeaveRequest(req, res, next) {
  try {
    const { startDate, endDate, reason } = req.body;
    const result = await leaveService.createLeaveRequest(req.user.userId, startDate, endDate, reason, req.app.get('io'));
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function approveLeaveRequest(req, res, next) {
  try {
    const { managerNote } = req.body;
    const result = await leaveService.approveLeaveRequest(req.params.id, req.user.userId, managerNote, req.app.get('io'));
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function rejectLeaveRequest(req, res, next) {
  try {
    const { managerNote } = req.body;
    const result = await leaveService.rejectLeaveRequest(req.params.id, req.user.userId, managerNote, req.app.get('io'));
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function cancelLeaveRequest(req, res, next) {
  try {
    const result = await leaveService.cancelLeaveRequest(req.params.id, req.user.userId, req.app.get('io'));
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getAllLeaveRequests(req, res, next) {
  try {
    const { status, userId } = req.query;
    const where = {};
    if (status) where.status = status;

    if (req.user.role === 'staff') {
      where.userId = req.user.userId;
    } else if (req.user.role === 'manager') {
      if (userId) {
        where.userId = userId;
      } else {
        // Find staff at manager's locations
        // This is simplified, real implementation should filter by location scope
      }
    } else if (req.user.role === 'admin') {
      if (userId) where.userId = userId;
    }

    const requests = await LeaveRequest.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'manager', attributes: ['id', 'name'] }
      ]
    });
    res.json(requests);
  } catch (err) {
    next(err);
  }
}

export async function updateSundayAvailability(req, res, next) {
  try {
    const { enabled, startTime, endTime } = req.body;
    const userId = req.params.id;

    if (enabled) {
      await Availability.upsert({
        userId,
        dayOfWeek: 0, // Sunday
        startTime: startTime || '00:00',
        endTime: endTime || '23:59'
      });
      res.json({ success: true });
    } else {
      await Availability.destroy({ where: { userId, dayOfWeek: 0 } });
      res.json({ removed: true });
    }
  } catch (err) {
    next(err);
  }
}
