import { getField, parseReading } from './fieldMap.js';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export const ALL_FLAG_TYPES = [
  { key: 'rollback', label: 'Rollback', severity: 'high' },
  { key: 'reverse', label: 'Reverse', severity: 'high' },
  { key: 'huge_jump', label: 'Huge jump', severity: 'high' },
  { key: 'growth_anomaly', label: 'Growth anomaly', severity: 'medium' },
  { key: 'stale_no_reading', label: 'Stale (no reading)', severity: 'medium' },
  { key: 'stale_unchanged', label: 'Stale (unchanged)', severity: 'medium' },
];

export function groupBySerial(submissions) {
  const groups = {};
  for (const sub of submissions) {
    const serial = getField(sub, 'serial');
    if (!serial) continue;
    if (!groups[serial]) groups[serial] = [];
    groups[serial].push(sub);
  }
  for (const serial in groups) {
    groups[serial].sort((a, b) => new Date(a._submission_time).getTime() - new Date(b._submission_time).getTime());
  }
  return groups;
}

function medianDailyGrowth(list) {
  const rates = [];
  for (let i = 1; i < list.length; i++) {
    const a = parseReading(getField(list[i - 1], 'endReading'));
    const b = parseReading(getField(list[i], 'endReading'));
    const t0 = new Date(list[i - 1]._submission_time).getTime();
    const t1 = new Date(list[i]._submission_time).getTime();
    if (Number.isNaN(a) || Number.isNaN(b)) continue;
    const days = (t1 - t0) / MS_PER_DAY;
    if (days <= 0) continue;
    const delta = b - a;
    if (delta < 0) continue;
    rates.push(delta / days);
  }
  if (rates.length < 2) return null;
  rates.sort((x, y) => x - y);
  return rates[Math.floor(rates.length / 2)];
}

export function detectRedFlags(submissions, options = {}) {
  const { enabled = {}, hugeJumpThreshold = 100000, staleDays = 10, anomalyMultiplier = 5, nowDate = new Date() } = options;
  const isOn = (k) => enabled[k] !== false;
  const groups = groupBySerial(submissions);
  const flagged = {};

  for (const serial in groups) {
    const list = groups[serial];
    const median = medianDailyGrowth(list);

    for (let i = 0; i < list.length; i++) {
      const sub = list[i];
      const id = sub._id;
      const startR = parseReading(getField(sub, 'startReading'));
      const endR = parseReading(getField(sub, 'endReading'));
      const flags = [];

      if (isOn('reverse') && !Number.isNaN(startR) && !Number.isNaN(endR) && startR !== endR && endR < startR) {
        flags.push({ type: 'reverse', severity: 'high', message: `End reading (${endR}) < start reading (${startR})` });
      }
      if (i > 0) {
        const prev = list[i - 1];
        const prevEnd = parseReading(getField(prev, 'endReading'));
        const prevTime = new Date(prev._submission_time).getTime();
        const currTime = new Date(sub._submission_time).getTime();
        const daysGap = (currTime - prevTime) / MS_PER_DAY;
        if (!Number.isNaN(prevEnd) && !Number.isNaN(endR)) {
          if (isOn('rollback') && endR < prevEnd) {
            flags.push({ type: 'rollback', severity: 'high', message: `Reading ${endR} < previous ${prevEnd}`, previousReading: prevEnd, previousSubmissionId: prev._id, previousDate: prev._submission_time, currentReading: endR });
          } else if (isOn('huge_jump') && endR - prevEnd > hugeJumpThreshold) {
            flags.push({ type: 'huge_jump', severity: 'high', message: `Jumped ${(endR - prevEnd).toLocaleString()} units`, previousReading: prevEnd, previousSubmissionId: prev._id, previousDate: prev._submission_time, currentReading: endR });
          } else if (isOn('growth_anomaly') && median !== null && daysGap > 0) {
            const rate = (endR - prevEnd) / daysGap;
            if (median > 0 && rate > median * anomalyMultiplier && (endR - prevEnd) > 50) {
              flags.push({ type: 'growth_anomaly', severity: 'medium', message: `Used ${(endR - prevEnd).toLocaleString()} in ${daysGap.toFixed(1)}d — ${(rate / median).toFixed(1)}× normal`, previousReading: prevEnd, previousSubmissionId: prev._id, previousDate: prev._submission_time, currentReading: endR });
            }
          }
        }
      }
      if (flags.length > 0) flagged[id] = { flags, serial };
    }

    if (list.length > 0) {
      const last = list[list.length - 1];
      const id = last._id;
      const daysSince = (nowDate.getTime() - new Date(last._submission_time).getTime()) / MS_PER_DAY;
      const lastReading = parseReading(getField(last, 'endReading'));
      if (isOn('stale_no_reading') && daysSince > staleDays) {
        const existing = flagged[id] || { flags: [], serial };
        existing.flags.push({ type: 'stale_no_reading', severity: 'medium', message: `No reading for ${daysSince.toFixed(0)} days` });
        flagged[id] = existing;
      }
      if (isOn('stale_unchanged') && list.length >= 3) {
        const a = parseReading(getField(list[list.length - 3], 'endReading'));
        const b = parseReading(getField(list[list.length - 2], 'endReading'));
        const c = lastReading;
        if (!Number.isNaN(a) && !Number.isNaN(b) && !Number.isNaN(c) && a === b && b === c && a > 0) {
          const existing = flagged[id] || { flags: [], serial };
          existing.flags.push({ type: 'stale_unchanged', severity: 'medium', message: `Reading stuck at ${c} for 3 submissions` });
          flagged[id] = existing;
        }
      }
    }
  }
  return flagged;
}
