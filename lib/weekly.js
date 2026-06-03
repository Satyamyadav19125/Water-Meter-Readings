import { getField, parseReading } from './fieldMap.js';
import { groupBySerial } from './redflags.js';

export function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
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

export function computeWeeklyStatus(meters, submissions, refDate = new Date()) {
  const weekStart = startOfWeek(refDate);
  const weekEnd = endOfWeek(refDate);

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

export function daysRemaining(refDate = new Date()) {
  const end = endOfWeek(refDate);
  const ms = end.getTime() - refDate.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export function deriveMeters(assignments, submissions) {
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

export function computeConsumption(submissions) {
  const groups = groupBySerial(submissions);
  const results = [];
  for (const serial in groups) {
    const list = groups[serial];
    const consumption = [];
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      const curr = list[i];
      const prevEnd = parseReading(getField(prev, 'endReading'));
      const currEnd = parseReading(getField(curr, 'endReading'));
      if (Number.isNaN(prevEnd) || Number.isNaN(currEnd)) continue;
      const used = currEnd - prevEnd;
      consumption.push({
        fromSubmissionId: prev._id,
        toSubmissionId: curr._id,
        fromReading: prevEnd,
        toReading: currEnd,
        used,
        fromDate: prev._submission_time,
        toDate: curr._submission_time,
        flagged: used < 0,
      });
    }
    const village = getField(list[0], 'village');
    results.push({ serial, village, consumption, latestReading: parseReading(getField(list[list.length - 1], 'endReading')) });
  }
  return results.sort((a, b) => (a.village || '').localeCompare(b.village || ''));
}
