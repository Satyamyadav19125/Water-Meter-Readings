import { getField, parseReading } from './fieldMap.js';
import { groupBySerial } from './redflags.js';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

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

export function daysRemaining(refDate = new Date()) {
  const end = endOfWeek(refDate);
  const ms = end.getTime() - refDate.getTime();
  return Math.max(0, Math.floor(ms / MS_PER_DAY));
}

export function deriveMeters(assignments, submissions) {
  const villageToPerson = new Map();
  const villageToPhone = new Map();

  for (const a of assignments) {
    const villages = Array.isArray(a.villages) ? a.villages : null;
    if (villages) {
      for (const v of villages) {
        if (!villageToPerson.has(v)) villageToPerson.set(v, a.person);
        if (!villageToPhone.has(v) && a.phone) villageToPhone.set(v, a.phone);
      }
    } else if (Array.isArray(a.meters)) {
      for (const m of a.meters) {
        if (m.village && !villageToPerson.has(m.village)) {
          villageToPerson.set(m.village, a.person);
          if (a.phone) villageToPhone.set(m.village, a.phone);
        }
      }
    }
  }

  const seen = new Map();
  for (const sub of submissions) {
    const village = getField(sub, 'village');
    const serial = getField(sub, 'serial');
    if (!serial) continue;
    const key = `${village || 'Unknown'}|${serial}`;
    if (!seen.has(key)) {
      seen.set(key, {
        village: village || 'Unknown',
        serial,
        assignedTo: villageToPerson.get(village) || 'Unassigned',
        assignedPhone: villageToPhone.get(village) || null,
      });
    }
  }
  return Array.from(seen.values());
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
  const lastByMeter = {};
  for (const sub of submissions) {
    const serial = getField(sub, 'serial');
    if (!serial) continue;
    const t = new Date(sub._submission_time).getTime();
    if (!lastByMeter[serial] || t > lastByMeter[serial]) lastByMeter[serial] = t;
  }
  return meters.map((m) => {
    const list = buckets[m.serial] || [];
    const submittedCount = list.length;
    let status;
    if (submittedCount >= 2) status = 'done';
    else if (submittedCount === 1) status = 'partial';
    else status = 'pending';
    const lastTime = lastByMeter[m.serial];
    const daysSinceLast = lastTime ? Math.floor((refDate.getTime() - lastTime) / MS_PER_DAY) : null;
    return {
      ...m, submittedCount, required: 2, status, submissions: list,
      lastReadingDate: lastTime ? new Date(lastTime).toISOString() : null,
      daysSinceLast,
      weekStart: weekStart.toISOString(), weekEnd: weekEnd.toISOString(),
    };
  });
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
        fromSubmissionId: prev._id, toSubmissionId: curr._id,
        fromReading: prevEnd, toReading: currEnd, used,
        fromDate: prev._submission_time, toDate: curr._submission_time,
        fromSurveyor: getField(prev, 'surveyor'), toSurveyor: getField(curr, 'surveyor'),
        flagged: used < 0,
      });
    }
    let village = null;
    for (let i = list.length - 1; i >= 0; i--) {
      const v = getField(list[i], 'village');
      if (v) { village = v; break; }
    }
    const latestReading = list.length > 0 ? parseReading(getField(list[list.length - 1], 'endReading')) : null;
    const latestSurveyor = list.length > 0 ? getField(list[list.length - 1], 'surveyor') : null;
    results.push({ serial, village, consumption, latestReading, latestSurveyor, submissionCount: list.length });
  }
  return results.sort((a, b) => (a.village || '').localeCompare(b.village || ''));
}
