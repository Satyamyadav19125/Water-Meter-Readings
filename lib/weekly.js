// =====================================================================
// Weekly cycle tracker
// Rule: each water meter must be read twice in a 7-day window.
// Default week: Monday 00:00 to Sunday 23:59 (server time, India local).
// =====================================================================

import { getField } from './fieldMap.js';

/**
 * Return the start (Monday 00:00) of the week that the given date belongs to.
 * Uses Asia/Kolkata-aware logic by treating dates as UTC-shifted.
 */
export function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
  const diff = (day === 0 ? -6 : 1 - day); // Move back to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function endOfWeek(date) {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return end;
}

/**
 * Given a list of all meters (serial + village) and all submissions,
 * compute status for the CURRENT week.
 *
 * Returns array of:
 *   { serial, village, submittedCount, required: 2, status: 'done'|'partial'|'pending', submissions: [...] }
 */
export function computeWeeklyStatus(meters, submissions, refDate = new Date()) {
  const weekStart = startOfWeek(refDate);
  const weekEnd = endOfWeek(refDate);

  // Bucket submissions for this week by serial
  const buckets = {};
  for (const sub of submissions) {
    const t = new Date(sub._submission_time);
    if (t < weekStart || t >= weekEnd) continue;
    const serial = getField(sub, 'serial');
    if (!serial) continue;
    if (!buckets[serial]) buckets[serial] = [];
    buckets[serial].push(sub);
  }

  return meters.map((m) => {
    const list = buckets[m.serial] || [];
    const submittedCount = list.length;
    let status;
    if (submittedCount >= 2) status = 'done';
    else if (submittedCount === 1) status = 'partial';
    else status = 'pending';
    return {
      ...m,
      submittedCount,
      required: 2,
      status,
      submissions: list,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
    };
  });
}

/**
 * Days remaining (rounded down) until end of current week.
 */
export function daysRemaining(refDate = new Date()) {
  const end = endOfWeek(refDate);
  const ms = end.getTime() - refDate.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

/**
 * Build the master meter list by combining the assignments.json
 * (which lists all known village + meter pairs) with anything new
 * discovered in actual submissions.
 */
export function deriveMeters(assignments, submissions) {
  // From assignments: every (village, serial) pair listed there
  const known = new Set();
  const meters = [];

  for (const a of assignments) {
    for (const meter of a.meters || []) {
      const key = `${meter.village}|${meter.serial}`;
      if (!known.has(key)) {
        known.add(key);
        meters.push({
          village: meter.village,
          serial: meter.serial,
          assignedTo: a.person,
          assignedPhone: a.phone || null,
        });
      }
    }
  }

  // Also pick up any meters seen in submissions but not in assignments
  // (so they at least show up — they'll be marked "Unassigned")
  for (const sub of submissions) {
    const village = getField(sub, 'village');
    const serial = getField(sub, 'serial');
    if (!serial) continue;
    const key = `${village}|${serial}`;
    if (!known.has(key)) {
      known.add(key);
      meters.push({
        village: village || 'Unknown',
        serial,
        assignedTo: 'Unassigned',
        assignedPhone: null,
      });
    }
  }

  return meters;
}
