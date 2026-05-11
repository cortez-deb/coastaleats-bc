import { Op } from 'sequelize';
import { Shift, ShiftAssignment, Location } from '../models/index.js';
import { toLocal } from '../utils/timezone.js';
import { DateTime } from 'luxon';

export async function getWeeklyHours(userId, weekStart) {
  // weekStart is an ISO date string like '2024-01-01' representing the start of the week in UTC
  const startDt = DateTime.fromISO(weekStart, { zone: 'utc' });
  const endDt = startDt.plus({ days: 7 });

  const assignments = await ShiftAssignment.findAll({
    where: { userId, status: 'assigned' },
    include: [{
      model: Shift,
      as: 'shift',
      where: {
        startUtc: {
          [Op.gte]: startDt.toJSDate(),
          [Op.lt]: endDt.toJSDate()
        }
      }
    }]
  });

  let totalHours = 0;
  for (const assignment of assignments) {
    const shift = assignment.shift;
    const durationMs = shift.endUtc.getTime() - shift.startUtc.getTime();
    totalHours += durationMs / (1000 * 60 * 60);
  }

  return totalHours;
}

export async function getDailyHours(userId, localDate, locationTimezone) {
  // localDate is like '2024-01-01'
  const assignments = await ShiftAssignment.findAll({
    where: { userId, status: 'assigned' },
    include: [{ model: Shift, as: 'shift' }]
  });

  let dailyHours = 0;
  for (const assignment of assignments) {
    const shift = assignment.shift;
    const localStart = toLocal(shift.startUtc.toISOString(), locationTimezone);
    if (localStart.toFormat('yyyy-MM-dd') === localDate) {
      const durationMs = shift.endUtc.getTime() - shift.startUtc.getTime();
      dailyHours += durationMs / (1000 * 60 * 60);
    }
  }

  return dailyHours;
}

export async function getConsecutiveDays(userId, referenceDate, locationTimezone) {
  // Check backward from referenceDate. Max we need to look back is 7 days.
  // We fetch all assignments for the user in the past 10 days to be safe.
  const refDt = DateTime.fromISO(referenceDate, { zone: locationTimezone });
  const lookbackDt = refDt.minus({ days: 10 });

  const assignments = await ShiftAssignment.findAll({
    where: { userId, status: 'assigned' },
    include: [{
      model: Shift,
      as: 'shift',
      where: {
        startUtc: {
          [Op.gte]: lookbackDt.toUTC().toJSDate()
        }
      }
    }]
  });

  // Collect all unique local dates worked
  const workedDates = new Set();
  for (const assignment of assignments) {
    const localStart = toLocal(assignment.shift.startUtc.toISOString(), locationTimezone);
    workedDates.add(localStart.toFormat('yyyy-MM-dd'));
  }

  let consecutiveCount = 0;
  let currentDt = refDt;

  while (workedDates.has(currentDt.toFormat('yyyy-MM-dd'))) {
    consecutiveCount++;
    currentDt = currentDt.minus({ days: 1 });
  }

  return consecutiveCount;
}

export async function evaluateOvertime(userId, shiftId) {
  const shift = await Shift.findByPk(shiftId, {
    include: [{ model: Location, as: 'location' }]
  });
  if (!shift) throw new Error('Shift not found');

  const tz = shift.location.timezone;
  const localStart = toLocal(shift.startUtc.toISOString(), tz);
  const localDate = localStart.toFormat('yyyy-MM-dd');
  
  // Assuming week starts on Monday, find the Monday for this shift
  const weekStartDt = localStart.startOf('week'); // Luxon startOf('week') is Monday
  const weekStartISO = weekStartDt.toUTC().toISODate();

  const currentWeeklyHours = await getWeeklyHours(userId, weekStartISO);
  const currentDailyHours = await getDailyHours(userId, localDate, tz);
  const consecutiveDays = await getConsecutiveDays(userId, localStart.minus({ days: 1 }).toFormat('yyyy-MM-dd'), tz);

  const shiftDurationMs = shift.endUtc.getTime() - shift.startUtc.getTime();
  const shiftHours = shiftDurationMs / (1000 * 60 * 60);

  const projectedWeekly = currentWeeklyHours + shiftHours;
  const projectedDaily = currentDailyHours + shiftHours;
  const projectedConsecutive = consecutiveDays + 1;

  const results = [];

  if (projectedDaily > 12) {
    results.push({ level: 'block', rule: 'EXCESSIVE_DAY', message: 'Daily hours exceed 12' });
  } else if (projectedDaily > 8) {
    results.push({ level: 'warn', rule: 'LONG_DAY', message: 'Daily hours exceed 8' });
  }

  if (projectedWeekly > 40) {
    results.push({ level: 'warn', rule: 'OVERTIME', message: 'Weekly hours exceed 40' });
  } else if (projectedWeekly >= 35) {
    results.push({ level: 'warn', rule: 'APPROACHING_OVERTIME', message: 'Approaching 40 weekly hours' });
  }

  if (projectedConsecutive === 7) {
    results.push({ level: 'block', rule: 'SEVENTH_DAY', message: 'Seventh consecutive day requires override' });
  } else if (projectedConsecutive === 6) {
    results.push({ level: 'warn', rule: 'SIXTH_DAY', message: 'Sixth consecutive day' });
  }

  return results;
}
