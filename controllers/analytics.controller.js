import { Op } from 'sequelize';
import { Shift, ShiftAssignment, Location, User } from '../models/index.js';
import { coefficientOfVariation } from '../utils/fairness.js';
import { DateTime } from 'luxon';

export async function getDashboardStats(req, res, next) {
  try {
    const { locationId, startDate, endDate } = req.query;

    const where = {};
    if (locationId) where.locationId = locationId;
    if (startDate || endDate) {
      where.startUtc = {};
      if (startDate) where.startUtc[Op.gte] = new Date(startDate);
      if (endDate) where.startUtc[Op.lte] = new Date(endDate);
    }

    const shifts = await Shift.findAll({
      where,
      include: [
        { model: ShiftAssignment, as: 'assignments', include: [{ model: User, as: 'user' }] },
        { model: Location, as: 'location' }
      ]
    });

    let totalShifts = shifts.length;
    let totalAssignedHours = 0;
    let totalPremiumHours = 0;
    let totalUnfilledShifts = 0;
    
    // For fairness CV
    const staffHours = {}; 
    const staffDesired = {};

    for (const shift of shifts) {
      const durationHours = (shift.endUtc.getTime() - shift.startUtc.getTime()) / (1000 * 60 * 60);
      
      const assignedCount = shift.assignments.filter(a => a.status === 'assigned').length;
      if (assignedCount < shift.headcount) {
        totalUnfilledShifts++;
      }

      for (const assignment of shift.assignments) {
        if (assignment.status === 'assigned') {
          totalAssignedHours += durationHours;
          if (shift.isPremium) {
            totalPremiumHours += durationHours;
          }

          const userId = assignment.userId;
          if (!staffHours[userId]) {
            staffHours[userId] = 0;
            staffDesired[userId] = assignment.user.desiredHours || 40;
          }
          staffHours[userId] += durationHours;
        }
      }
    }

    const hoursAssignedArray = Object.values(staffHours);
    const cvHours = coefficientOfVariation(hoursAssignedArray);

    const ratios = Object.keys(staffHours).map(uid => staffHours[uid] / staffDesired[uid]);
    const cvRatio = coefficientOfVariation(ratios);

    res.json({
      totalShifts,
      totalAssignedHours,
      totalPremiumHours,
      totalUnfilledShifts,
      fairness: {
        cvHours,
        cvRatio
      }
    });
  } catch (err) {
    next(err);
  }
}
