import { Op } from 'sequelize';
import { 
  Shift, ShiftAssignment, User, UserLocation, UserSkill, 
  Availability, AvailabilityException, Location, Skill, LeaveRequest
} from '../models/index.js';
import { shiftWithinAvailability, toLocal, extractLocalDayAndTime } from '../utils/timezone.js';
import { getDailyHours, getConsecutiveDays, getWeeklyHours } from './labor.service.js';

export async function checkConstraints(userId, shiftId, overrideReason = null) {
  const result = {
    allowed: true,
    violations: [],
    warnings: [],
    requiresOverride: false,
    overrideTarget: null
  };

  const shift = await Shift.findByPk(shiftId, {
    include: [
      { model: Location, as: 'location' },
      { model: Skill, as: 'skill' }
    ]
  });

  if (!shift) {
    result.allowed = false;
    result.violations.push({ level: 'HARD', code: 'SHIFT_NOT_FOUND', message: 'Shift not found' });
    return result;
  }

  // Pre-check: Headcount
  const existingAssignments = await ShiftAssignment.count({
    where: { shiftId: shift.id, status: 'assigned' }
  });
  if (existingAssignments >= shift.headcount) {
    result.allowed = false;
    result.violations.push({ 
      level: 'HARD', 
      code: 'SHIFT_FULL', 
      message: `This shift already has ${existingAssignments}/${shift.headcount} staff assigned.` 
    });
    return result;
  }

  const user = await User.findByPk(userId);
  if (!user) {
    result.allowed = false;
    result.violations.push({ level: 'HARD', code: 'USER_NOT_FOUND', message: 'User not found' });
    return result;
  }

  const startUtc = shift.startUtc;
  const endUtc = shift.endUtc;
  const tz = shift.location.timezone;
  const localStart = toLocal(startUtc.toISOString(), tz);
  const localDate = localStart.toFormat('yyyy-MM-dd');

  // Helper for generating suggestions
  const getSuggestions = async () => {
    const certifiedUserIds = (await UserLocation.findAll({ where: { locationId: shift.locationId } })).map(ul => ul.userId);
    const skilledUserIds = (await UserSkill.findAll({ where: { skillId: shift.skillId } })).map(us => us.userId);
    let potentialUserIds = certifiedUserIds.filter(id => skilledUserIds.includes(id) && id !== userId);
    
    const validSuggestions = [];
    for (const uid of potentialUserIds) {
      const v = await checkConstraintsInternal(uid, shift, startUtc, endUtc, tz, localStart, localDate);
      if (v.length === 0) {
        const weekStartDt = localStart.startOf('week');
        const weeklyHours = await getWeeklyHours(uid, weekStartDt.toUTC().toISODate());
        const pUser = await User.findByPk(uid);
        validSuggestions.push({ userId: uid, name: pUser.name, reason: "Matches skill, location, and availability.", weeklyHours });
      }
    }
    validSuggestions.sort((a, b) => a.weeklyHours - b.weeklyHours);
    return validSuggestions.slice(0, 5).map(s => ({ userId: s.userId, name: s.name, reason: s.reason }));
  };

  // CHECK 1 — SKILL MATCH [HARD]
  const userSkill = await UserSkill.findOne({ where: { userId, skillId: shift.skillId } });
  if (!userSkill) {
    result.allowed = false;
    result.violations.push({
      level: 'HARD',
      code: 'SKILL_MISMATCH',
      message: `${user.name} does not have the required skill for this shift.`,
      suggestions: await getSuggestions()
    });
  }

  // CHECK 2 — LOCATION CERTIFICATION [HARD]
  const userLocation = await UserLocation.findOne({ where: { userId, locationId: shift.locationId } });
  if (!userLocation) {
    result.allowed = false;
    result.violations.push({
      level: 'HARD',
      code: 'NOT_CERTIFIED',
      message: `${user.name} is not certified to work at ${shift.location.name}.`,
      suggestions: await getSuggestions()
    });
  }

  // CHECK 3 — AVAILABILITY WINDOW [HARD]
  const exception = await AvailabilityException.findOne({ 
    where: { userId, date: localDate },
    include: [{ model: LeaveRequest, as: 'leaveRequest', required: false }]
  });
  
  let isAvailable = true;
  let reason = '';

  if (exception) {
    if (!exception.available) {
      isAvailable = false;
      reason = exception.leaveRequestId 
        ? `${user.name} is on approved leave.` 
        : `${user.name} has specifically blocked this day.`;
    } else if (exception.startTime && exception.endTime) {
      isAvailable = shiftWithinAvailability(startUtc.toISOString(), endUtc.toISOString(), exception.startTime, exception.endTime, tz);
      if (!isAvailable) {
        reason = `${user.name} is only available between ${exception.startTime} and ${exception.endTime} on this day.`;
      }
    }
  } else {
    const { dayOfWeek, dayName } = extractLocalDayAndTime(localStart);
    const recurring = await Availability.findOne({ where: { userId, dayOfWeek } });
    if (!recurring) {
      isAvailable = false;
      reason = `${user.name} has no availability set for ${dayName}s.`;
    } else {
      isAvailable = shiftWithinAvailability(startUtc.toISOString(), endUtc.toISOString(), recurring.startTime, recurring.endTime, tz);
      if (!isAvailable) {
        reason = `${user.name} is only available between ${recurring.startTime} and ${recurring.endTime} on ${dayName}s.`;
      }
    }
  }
  
  if (!isAvailable) {
    result.allowed = false;
    result.violations.push({
      level: 'HARD',
      code: 'UNAVAILABLE',
      message: reason || `${user.name} is not available during this shift time.`,
      suggestions: await getSuggestions()
    });
  }

  // Active assignments for checking 4, 5, 6, 7, 8
  const allAssignments = await ShiftAssignment.findAll({
    where: { userId, status: 'assigned' },
    include: [{ model: Shift, as: 'shift' }]
  });

  // CHECK 4 — NO DOUBLE-BOOKING [HARD]
  let doubleBooked = false;
  for (const a of allAssignments) {
    const existing = a.shift;
    if (existing.startUtc < endUtc && existing.endUtc > startUtc) {
      doubleBooked = true;
      const conflictLoc = await Location.findByPk(existing.locationId);
      result.allowed = false;
      result.violations.push({
        level: 'HARD',
        code: 'DOUBLE_BOOKED',
        message: `${user.name} is already assigned to an overlapping shift at ${conflictLoc ? conflictLoc.name : 'another location'} on ${localDate}.`
      });
      break;
    }
  }

  // CHECK 5 — MINIMUM REST GAP (10 HOURS) [HARD]
  const tenHoursMs = 10 * 60 * 60 * 1000;
  for (const a of allAssignments) {
    const existing = a.shift;
    if (existing.endUtc <= startUtc) {
      const gap = startUtc.getTime() - existing.endUtc.getTime();
      if (gap < tenHoursMs) {
        result.allowed = false;
        result.violations.push({
          level: 'HARD',
          code: 'REST_VIOLATION',
          message: `Only ${(gap / (1000 * 60 * 60)).toFixed(1)}h rest between shifts. Minimum is 10 hours.`
        });
      }
    } else if (existing.startUtc >= endUtc) {
      const gap = existing.startUtc.getTime() - endUtc.getTime();
      if (gap < tenHoursMs) {
        result.allowed = false;
        result.violations.push({
          level: 'HARD',
          code: 'REST_VIOLATION',
          message: `Only ${(gap / (1000 * 60 * 60)).toFixed(1)}h rest between shifts. Minimum is 10 hours.`
        });
      }
    }
  }

  // CHECK 6 — DAILY HOUR LIMIT [HARD >12h / WARN >8h]
  const shiftHours = (endUtc.getTime() - startUtc.getTime()) / (1000 * 60 * 60);
  let currentDailyHours = 0;
  for (const a of allAssignments) {
    const sLocal = toLocal(a.shift.startUtc.toISOString(), tz);
    if (sLocal.toFormat('yyyy-MM-dd') === localDate) {
      currentDailyHours += (a.shift.endUtc.getTime() - a.shift.startUtc.getTime()) / (1000 * 60 * 60);
    }
  }
  const projectedDaily = currentDailyHours + shiftHours;

  if (projectedDaily > 12) {
    if (overrideReason) {
      result.warnings.push({
        level: 'WARN',
        code: 'DAILY_HOURS_BLOCK',
        message: `Daily 12h limit exceeded (${projectedDaily.toFixed(1)}h) — approved with override: '${overrideReason}'.`
      });
    } else {
      result.allowed = false;
      result.requiresOverride = true;
      if (!result.overrideTarget) result.overrideTarget = "DAILY_HOURS_BLOCK";
      result.violations.push({
        level: 'HARD',
        code: 'DAILY_HOURS_BLOCK',
        message: `Assigning this shift would result in ${projectedDaily.toFixed(1)}h in one day (maximum is 12h). A documented reason is required to proceed.`
      });
    }
  } else if (projectedDaily > 8) {
    result.warnings.push({
      level: 'WARN',
      code: 'DAILY_HOURS_WARN',
      message: `This assignment results in ${projectedDaily.toFixed(1)}h worked in one day (over 8h).`
    });
  }

  // CHECK 7 — WEEKLY HOURS APPROACHING OVERTIME [WARN]
  const weekStartDt = localStart.startOf('week');
  const weekStartISO = weekStartDt.toUTC().toISODate();
  const currentWeeklyHours = await getWeeklyHours(userId, weekStartISO);
  const projectedWeekly = currentWeeklyHours + shiftHours;

  if (projectedWeekly >= 40) {
    result.warnings.push({
      level: 'WARN',
      code: 'WEEKLY_HOURS_WARN',
      message: `${user.name} would reach ${projectedWeekly.toFixed(1)}h this week, exceeding the 40h overtime threshold.`
    });
  } else if (projectedWeekly >= 35) {
    result.warnings.push({
      level: 'WARN',
      code: 'WEEKLY_HOURS_WARN',
      message: `${user.name} is projected at ${projectedWeekly.toFixed(1)}h this week, approaching the 40h overtime threshold.`
    });
  }

  // CHECK 8 — CONSECUTIVE DAYS WORKED [HARD 7th / WARN 6th]
  const consecutiveDays = await getConsecutiveDays(userId, localStart.minus({ days: 1 }).toFormat('yyyy-MM-dd'), tz);
  const projectedConsecutive = consecutiveDays + 1;

  if (projectedConsecutive >= 7) {
    if (overrideReason) {
      result.warnings.push({
        level: 'WARN',
        code: 'CONSECUTIVE_DAY_BLOCK',
        message: `7th consecutive day approved with override: '${overrideReason}'.`
      });
    } else {
      result.allowed = false;
      result.requiresOverride = true;
      if (!result.overrideTarget) result.overrideTarget = "CONSECUTIVE_DAY_BLOCK";
      result.violations.push({
        level: 'HARD',
        code: 'CONSECUTIVE_DAY_BLOCK',
        message: `This would be ${user.name}'s 7th consecutive day. A documented reason is required to proceed.`
      });
    }
  } else if (projectedConsecutive === 6) {
    result.warnings.push({
      level: 'WARN',
      code: 'CONSECUTIVE_DAY_WARN',
      message: `This would be ${user.name}'s 6th consecutive day. Consider scheduling a rest day.`
    });
  }

  return result;
}

// Helper to quickly find if a user has any hard blocks without recursive queries
async function checkConstraintsInternal(userId, shift, startUtc, endUtc, tz, localStart, localDate) {
  const v = [];
  const allAssignments = await ShiftAssignment.findAll({
    where: { userId, status: 'assigned' },
    include: [{ model: Shift, as: 'shift' }]
  });

  for (const a of allAssignments) {
    const existing = a.shift;
    if (existing.startUtc < endUtc && existing.endUtc > startUtc) {
      v.push('DOUBLE_BOOKED');
      break;
    }
  }

  const tenHoursMs = 10 * 60 * 60 * 1000;
  for (const a of allAssignments) {
    const existing = a.shift;
    if (existing.endUtc <= startUtc && (startUtc.getTime() - existing.endUtc.getTime()) < tenHoursMs) v.push('REST_VIOLATION');
    if (existing.startUtc >= endUtc && (existing.startUtc.getTime() - endUtc.getTime()) < tenHoursMs) v.push('REST_VIOLATION');
  }

  const exception = await AvailabilityException.findOne({ where: { userId, date: localDate } });
  let isAvailable = true;
  if (exception) {
    if (!exception.available) isAvailable = false;
    else if (exception.startTime && exception.endTime) isAvailable = shiftWithinAvailability(startUtc.toISOString(), endUtc.toISOString(), exception.startTime, exception.endTime, tz);
  } else {
    const { dayOfWeek } = extractLocalDayAndTime(localStart);
    const recurring = await Availability.findOne({ where: { userId, dayOfWeek } });
    if (!recurring) isAvailable = false;
    else isAvailable = shiftWithinAvailability(startUtc.toISOString(), endUtc.toISOString(), recurring.startTime, recurring.endTime, tz);
  }
  if (!isAvailable) v.push('UNAVAILABLE');

  let currentDailyHours = 0;
  for (const a of allAssignments) {
    const sLocal = toLocal(a.shift.startUtc.toISOString(), tz);
    if (sLocal.toFormat('yyyy-MM-dd') === localDate) {
      currentDailyHours += (a.shift.endUtc.getTime() - a.shift.startUtc.getTime()) / (1000 * 60 * 60);
    }
  }
  const shiftHours = (endUtc.getTime() - startUtc.getTime()) / (1000 * 60 * 60);
  if (currentDailyHours + shiftHours > 12) v.push('DAILY_HOURS_BLOCK');

  const consecutiveDays = await getConsecutiveDays(userId, localStart.minus({ days: 1 }).toFormat('yyyy-MM-dd'), tz);
  if (consecutiveDays + 1 >= 7) v.push('CONSECUTIVE_DAY_BLOCK');

  return v;
}
