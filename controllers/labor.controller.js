import { getWeeklyHours, getDailyHours, getConsecutiveDays, evaluateOvertime } from '../services/labor.service.js';
import { User, UserLocation, Location } from '../models/index.js';
import { DateTime } from 'luxon';
import { toLocal } from '../utils/timezone.js';

export async function getLaborStatus(req, res, next) {
  try {
    const userId = req.params.userId;
    const { date } = req.query; // optional reference date
    
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });

    // Use primary location timezone for daily calculation if multiple, or just UTC if none.
    // Assuming we pick the first certified location.
    const userLoc = await UserLocation.findOne({ where: { userId }, include: [{ model: Location, as: 'Location' }] });
    const tz = userLoc ? userLoc.Location.timezone : 'UTC';

    const refDate = date ? DateTime.fromISO(date, { zone: tz }) : DateTime.now().setZone(tz);
    const localDateStr = refDate.toFormat('yyyy-MM-dd');
    const weekStartISO = refDate.startOf('week').toUTC().toISODate();

    const weeklyHours = await getWeeklyHours(userId, weekStartISO);
    const dailyHours = await getDailyHours(userId, localDateStr, tz);
    const consecutiveDays = await getConsecutiveDays(userId, localDateStr, tz);

    res.json({
      userId,
      date: localDateStr,
      weeklyHours,
      dailyHours,
      consecutiveDays,
      timezone: tz
    });
  } catch (err) {
    next(err);
  }
}

export async function evaluateShiftOvertime(req, res, next) {
  try {
    const { userId, shiftId } = req.query;
    
    if (!userId || !shiftId) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'userId and shiftId are required' });
    }

    const results = await evaluateOvertime(userId, shiftId);
    
    res.json({
      userId,
      shiftId,
      warnings: results
    });
  } catch (err) {
    next(err);
  }
}
