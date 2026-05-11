import { DateTime } from 'luxon';

// Convert a UTC ISO string to a Luxon DateTime in the given IANA timezone
export function toLocal(utcISO, ianaTimezone) {
  return DateTime.fromISO(utcISO).setZone(ianaTimezone);
}

// Given a Luxon DateTime, return { dayOfWeek: 0-6, timeString: "HH:mm" }
export function extractLocalDayAndTime(luxonDt) {
  // Luxon weekday is 1-7 (Mon-Sun). We want 0-6 (Sun-Sat).
  const luxonWeekday = luxonDt.weekday;
  const dayOfWeek = luxonWeekday === 7 ? 0 : luxonWeekday;
  const dayName = luxonDt.weekdayLong;
  const timeString = luxonDt.toFormat('HH:mm');
  return { dayOfWeek, dayName, timeString };
}

// Check if shift (startUtc, endUtc as ISO strings) falls within availability window
// (startTime, endTime as "HH:mm"). Handles overnight shifts correctly.
export function shiftWithinAvailability(startUtc, endUtc, availStartTime, availEndTime, locationTimezone) {
  const localStart = toLocal(startUtc, locationTimezone);
  const localEnd = toLocal(endUtc, locationTimezone);

  const shiftStartMin = localStart.hour * 60 + localStart.minute;
  // If the shift spans across days (overnight), calculate end minutes relative to the start day
  let shiftEndMin = localEnd.hour * 60 + localEnd.minute;
  if (localEnd.day !== localStart.day || localEnd < localStart) {
    shiftEndMin += 24 * 60;
  }

  const [availStartH, availStartM] = availStartTime.split(':').map(Number);
  const [availEndH, availEndM] = availEndTime.split(':').map(Number);
  const availStartMin = availStartH * 60 + availStartM;
  let availEndMin = availEndH * 60 + availEndM;

  if (availEndMin < availStartMin) {
    availEndMin += 24 * 60;
  }

  return shiftStartMin >= availStartMin && shiftEndMin <= availEndMin;
}

// Returns true if the shift's local start is Fri/Sat at or after 17:00
export function isPremiumShift(startUtc, locationTimezone) {
  const localStart = toLocal(startUtc, locationTimezone);
  const { dayOfWeek } = extractLocalDayAndTime(localStart);
  return (dayOfWeek === 5 || dayOfWeek === 6) && localStart.hour >= 17;
}
