import { getField, parseReading } from './fieldMap.js';
import { distanceMeters } from './coords.js';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export const ALL_FLAG_TYPES = [
  { key: 'rollback', label: 'Rollback (reading went backwards)', severity: 'high' },
  { key: 'reverse', label: 'Reverse (end < start within submission)', severity: 'high' },
  { key: 'huge_jump', label: 'Huge jump (>100,000 units)', severity: 'high' },
  { key: 'location_far', label: 'GPS far outside the whole project area (e.g. lat/long swapped or mistyped)', severity: 'high' },
  { key: 'geofence', label: 'Reading taken outside the meter\'s set location radius', severity: 'medium' },
  { key: 'growth_anomaly', label: 'Growth anomaly (5x normal rate)', severity: 'medium' },
  { key: 'stale_no_reading', label: 'Stale (no reading for 10+ days)', severity: 'medium' },
  { key: 'stale_unchanged', label: 'Stuck (3 same readings in a row)', severity: 'medium' },
  { key: 'missing_photo', label: 'Missing meter photo', severity: 'low' },
  { key: 'invalid_meter_id', label: 'Invalid meter ID format', severity: 'low' },
  { key: 'future_date', label: 'Future-dated reading', severity: 'medium' },
  { key: 'zero_consumption', label: 'Zero usage over 7+ days', severity: 'medium' },
  { key: 'gps_outlier', label: 'GPS far from this meter\'s usual spot', severity: 'medium' },
  { key: 'digit_count', label: 'Digit-count jump (likely typo)', severity: 'medium' },
  { key: 'out_of_sequence', label: 'Date earlier than previous reading', severity: 'medium' },
  { key: 'duplicate_same_day', label: 'Same meter read twice in one day', severity: 'low' },
  { key: 'identical_gps', label: 'Same GPS used by different meters', severity: 'medium' },
  { key: 'fabrication_speed', label: 'Surveyor logged readings impossibly fast', severity: 'medium' },
  { key: 'night_reading', label: 'Reading taken at night (10pm-5am)', severity: 'low' },
  { key: 'village_outlier', label: 'Usage far above village neighbours', severity: 'medium' },
];

function parseLoc(val) {
  if (val == null) return null;
  if (typeof val === 'object') {
    const lat = val.latitude ?? val.lat ?? (Array.isArray(val) ? val[0] : undefined);
    const lng = val.longitude ?? val.lng ?? (Array.isArray(val) ? val[1] : undefined);
    if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng };
    return null;
  }
  const parts = String(val).trim().split(/\s+/).map(Number);
  if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) return { lat: parts[0], lng: parts[1] };
  return null;
}

function haversineMeters(a, b) {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const la1 = a.lat * Math.PI / 180;
  const la2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}

function hourOf(timeStr) {
  if (!timeStr) return null;
  const m = String(timeStr).match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  return Number.isNaN(h) ? null : h;
}

// The date a reading was actually TAKEN in the field. Kobo's _submission_time
// is when the phone uploaded it, which can be days later if the surveyor was
// offline — so every date-based rule uses the form date first.
export function readingTime(sub) {
  const d = getField(sub, 'date');
  if (d) {
    const t = new Date(d).getTime();
    if (!Number.isNaN(t)) return t;
  }
  const t2 = new Date(sub._submission_time).getTime();
  return Number.isNaN(t2) ? 0 : t2;
}

// Seconds-since-midnight of the reading's field time (start time first, then end
// time), so two readings taken on the SAME date can still be ordered by when
// they were actually taken.
function timeOfDaySeconds(sub) {
  const t = getField(sub, 'startTime') || getField(sub, 'endTime');
  const m = /(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(String(t || ''));
  if (!m) return null;
  return (parseInt(m[1], 10) || 0) * 3600 + (parseInt(m[2], 10) || 0) * 60 + (parseInt(m[3], 10) || 0);
}

// A finer-grained instant than readingTime: the field DATE plus the time-of-day
// from the form. Used ONLY for ORDERING (so the earlier of two same-day readings
// sorts first, and rollback compares them in the right order). Day-based keys and
// windows keep using readingTime so nothing else shifts.
export function readingInstant(sub) {
  const base = readingTime(sub);
  const secs = timeOfDaySeconds(sub);
  return secs == null ? base : base + secs * 1000;
}

// Same-day duplicates. A duplicate is the SAME meter (+farm) on the SAME field
// DATE with the SAME reading value — i.e. an accidental re-submission of the
// same form. Two reads of the same meter on one day at DIFFERENT times with
// DIFFERENT readings are legitimate and are NOT treated as duplicates. Returns a
// map id -> [other ids] and a Set of all involved ids. Dead readings are
// INCLUDED so a pair the admin already resolved still shows.
export function sameDayDuplicates(submissions) {
  const groups = {};
  for (const sub of submissions) {
    const serial = getField(sub, 'serial');
    if (!serial) continue;
    const t = readingTime(sub);
    if (!t) continue;
    const farm = getField(sub, 'farm') || '';
    const reading = String(getField(sub, 'endReading') ?? getField(sub, 'reading') ?? '').trim();
    const key = `${farm}|${serial}|${new Date(t).toISOString().slice(0, 10)}|${reading}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(sub._id);
  }
  const map = {};
  const ids = new Set();
  for (const key in groups) {
    const arr = groups[key];
    if (arr.length < 2) continue;
    for (const id of arr) {
      map[id] = arr.filter((x) => x !== id);
      ids.add(String(id));
    }
  }
  return { map, ids };
}

export function groupBySerial(submissions) {
  const groups = {};
  for (const sub of submissions) {
    const serial = getField(sub, 'serial');
    if (!serial) continue;
    if (!groups[serial]) groups[serial] = [];
    groups[serial].push(sub);
  }
  for (const serial in groups) {
    // Order by the fine-grained instant so same-day readings sort by their real
    // time — this is what stops a later-but-earlier-uploaded reading looking like
    // a rollback of an earlier one.
    groups[serial].sort((a, b) => readingInstant(a) - readingInstant(b));
  }
  return groups;
}

function medianDailyGrowth(list) {
  const rates = [];
  for (let i = 1; i < list.length; i++) {
    const a = parseReading(getField(list[i - 1], 'endReading'));
    const b = parseReading(getField(list[i], 'endReading'));
    const t0 = readingTime(list[i - 1]);
    const t1 = readingTime(list[i]);
    if (Number.isNaN(a) || Number.isNaN(b)) continue;
    const days = (t1 - t0) / MS_PER_DAY;
    if (days <= 0) continue;
    const delta = b - a;
    if (delta < 0) continue;
    rates.push(delta / days);
  }
  if (rates.length < 2) return null;
  return median(rates);
}

export function detectRedFlags(submissions, options = {}) {
  const {
    enabled = {}, hugeJumpThreshold = 100000, staleDays = 10,
    anomalyMultiplier = 5, nowDate = new Date(),
    maxLocationKm = 100, flagWindowDays = null,
    geofence = null, refLocations = null,
  } = options;
  const isOn = (k) => enabled[k] !== false;
  const isOptIn = (k) => enabled[k] === true;

  const groups = groupBySerial(submissions);
  const flagged = {};
  const push = (id, serial, flag) => {
    if (!flagged[id]) flagged[id] = { flags: [], serial };
    flagged[id].flags.push(flag);
  };

  // ---- GLOBAL PRE-PASSES (for cross-meter / cross-surveyor checks) ----

  // identical_gps: which exact coordinates are shared by multiple distinct meters
  const gpsToSerials = {};
  const coordKeyOf = {};
  if (isOptIn('identical_gps')) {
    for (const sub of submissions) {
      const loc = parseLoc(getField(sub, 'location')) || parseLoc(sub._geolocation);
      const serial = getField(sub, 'serial');
      if (!loc || !serial) continue;
      const key = `${loc.lat.toFixed(5)},${loc.lng.toFixed(5)}`;
      coordKeyOf[sub._id] = key;
      if (!gpsToSerials[key]) gpsToSerials[key] = new Set();
      gpsToSerials[key].add(String(serial));
    }
  }

  // fabrication_speed: per surveyor, submissions less than 15s apart on the SAME
  // field day (bulk-uploads after days offline are not counted).
  const fabSuspect = new Set();
  if (isOptIn('fabrication_speed')) {
    const bySurveyor = {};
    for (const sub of submissions) {
      const sv = getField(sub, 'surveyor') || 'Unknown';
      if (!bySurveyor[sv]) bySurveyor[sv] = [];
      bySurveyor[sv].push({ id: sub._id, t: new Date(sub._submission_time).getTime(), day: new Date(readingTime(sub)).toISOString().slice(0, 10) });
    }
    for (const sv in bySurveyor) {
      const arr = bySurveyor[sv].sort((a, b) => a.t - b.t);
      for (let i = 1; i < arr.length; i++) {
        if (arr[i].day === arr[i - 1].day && arr[i].t - arr[i - 1].t < 15000) fabSuspect.add(arr[i].id);
      }
    }
  }

  // village_outlier: meters whose avg daily usage is far above their village median
  const villageOutlierLatestId = new Set();
  if (isOptIn('village_outlier')) {
    const meterAvg = {};   // serial -> avg daily usage
    const meterVillage = {};
    const meterLatestId = {};
    for (const serial in groups) {
      const list = groups[serial];
      const med = medianDailyGrowth(list);
      if (med != null) meterAvg[serial] = med;
      meterVillage[serial] = getField(list[list.length - 1], 'village') || 'Unknown';
      meterLatestId[serial] = list[list.length - 1]._id;
    }
    const byVillage = {};
    for (const serial in meterAvg) {
      const v = meterVillage[serial];
      if (!byVillage[v]) byVillage[v] = [];
      byVillage[v].push({ serial, avg: meterAvg[serial] });
    }
    for (const v in byVillage) {
      const arr = byVillage[v];
      if (arr.length < 3) continue;
      const vm = median(arr.map((x) => x.avg));
      if (!vm || vm <= 0) continue;
      for (const { serial, avg } of arr) {
        if (avg > vm * 4 && avg > 50) villageOutlierLatestId.add(meterLatestId[serial]);
      }
    }
  }

  // location_far: the whole project sits in one small area. If a reading's GPS
  // is hundreds/thousands of km from the centre of ALL readings, the surveyor
  // almost certainly swapped lat/long or mistyped a coordinate. Median centre so
  // the bad points can't drag it; a single wild outlier still trips.
  let projectCentre = null;
  const maxLocationMeters = Number.isFinite(Number(maxLocationKm)) && Number(maxLocationKm) > 0
    ? Number(maxLocationKm) * 1000 : null;
  if (isOn('location_far') && maxLocationMeters) {
    const allLocs = [];
    for (const sub of submissions) {
      const loc = parseLoc(getField(sub, 'location')) || parseLoc(sub._geolocation);
      if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) allLocs.push(loc);
    }
    if (allLocs.length >= 5) {
      projectCentre = { lat: median(allLocs.map((l) => l.lat)), lng: median(allLocs.map((l) => l.lng)) };
    }
  }

  // ---- PER-METER / PER-SUBMISSION CHECKS ----
  for (const serial in groups) {
    const list = groups[serial];
    const med = medianDailyGrowth(list);

    const locs = list.map((s) => parseLoc(getField(s, 'location')) || parseLoc(s._geolocation)).filter(Boolean);
    let centre = null;
    if (locs.length >= 3) centre = { lat: median(locs.map((l) => l.lat)), lng: median(locs.map((l) => l.lng)) };

    const digitCounts = list.map((s) => {
      const r = parseReading(getField(s, 'endReading'));
      return Number.isNaN(r) ? null : String(Math.trunc(Math.abs(r))).length;
    }).filter((x) => x != null);
    const medDigits = median(digitCounts);

    const seenDays = {};

    for (let i = 0; i < list.length; i++) {
      const sub = list[i];
      const id = sub._id;
      const startR = parseReading(getField(sub, 'startReading'));
      const endR = parseReading(getField(sub, 'endReading'));
      const subTime = readingTime(sub);

      if (isOn('reverse') && !Number.isNaN(startR) && !Number.isNaN(endR) && startR !== endR && endR < startR) {
        push(id, serial, { type: 'reverse', severity: 'high', message: `End reading (${endR}) < start reading (${startR})` });
      }

      if (isOptIn('missing_photo')) {
        const hasPhoto = (sub._attachments && sub._attachments.length > 0) || getField(sub, 'photo');
        if (!hasPhoto) push(id, serial, { type: 'missing_photo', severity: 'low', message: 'No meter photo attached to this submission' });
      }

      if (isOptIn('invalid_meter_id')) {
        if (!/^WM\d{6,}$/i.test(String(serial))) {
          push(id, serial, { type: 'invalid_meter_id', severity: 'low', message: `Meter ID "${serial}" doesn't match the expected WM###### format` });
        }
      }

      if (isOn('future_date')) {
        const d = getField(sub, 'date');
        if (d) {
          const dt = new Date(d).getTime();
          if (!Number.isNaN(dt) && dt > nowDate.getTime() + MS_PER_DAY) {
            push(id, serial, { type: 'future_date', severity: 'medium', message: `Reading date (${d}) is in the future` });
          }
        }
      }

      if (isOptIn('digit_count') && medDigits && !Number.isNaN(endR)) {
        const dc = String(Math.trunc(Math.abs(endR))).length;
        if (Math.abs(dc - medDigits) >= 2) {
          push(id, serial, { type: 'digit_count', severity: 'medium', message: `Reading ${endR} has ${dc} digits but this meter usually has ${medDigits}. Possible extra/missing digit.` });
        }
      }

      if (isOptIn('gps_outlier') && centre) {
        const loc = parseLoc(getField(sub, 'location')) || parseLoc(sub._geolocation);
        if (loc) {
          const dist = haversineMeters(centre, loc);
          if (dist > 500) {
            push(id, serial, { type: 'gps_outlier', severity: 'medium', message: `Reading taken ${Math.round(dist)} m from where this meter is usually read. Possible wrong meter or location error.` });
          }
        }
      }

      if (isOn('location_far') && projectCentre) {
        const loc = parseLoc(getField(sub, 'location')) || parseLoc(sub._geolocation);
        if (loc) {
          const dist = haversineMeters(projectCentre, loc);
          if (dist > maxLocationMeters) {
            const km = Math.round(dist / 1000);
            push(id, serial, { type: 'location_far', severity: 'high', message: `GPS is ${km.toLocaleString()} km from the centre of every other reading (recorded ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}). The latitude/longitude were probably swapped or mistyped.` });
          }
        }
      }

      if (isOptIn('identical_gps')) {
        const key = coordKeyOf[id];
        if (key && gpsToSerials[key] && gpsToSerials[key].size > 1) {
          push(id, serial, { type: 'identical_gps', severity: 'medium', message: `These exact GPS coordinates are used by ${gpsToSerials[key].size} different meters. Surveyor may not have moved between meters.` });
        }
      }

      // Geofence: reading taken too far from this meter's reference location
      // (from the Google Sheet synced in Settings → Meter locations).
      if (isOn('geofence') && geofence && geofence.enabled && refLocations) {
        const ref = refLocations[serial] || refLocations[String(serial).toUpperCase()];
        if (ref) {
          const loc = parseLoc(getField(sub, 'location')) || parseLoc(sub._geolocation);
          if (loc) {
            const dist = distanceMeters(ref, loc);
            const radius = Number(geofence.radiusMeters) || 50;
            if (dist > radius) {
              push(id, serial, { type: 'geofence', severity: 'medium', message: `Reading taken ${dist.toFixed(0)} m from this meter's set location — beyond the ${radius} m radius. Possibly read at the wrong meter.` });
            }
          }
        }
      }

      if (isOptIn('night_reading')) {
        const h = hourOf(getField(sub, 'endTime') || getField(sub, 'startTime'));
        if (h != null && (h < 5 || h >= 22)) {
          push(id, serial, { type: 'night_reading', severity: 'low', message: `Reading taken at ${String(h).padStart(2, '0')}:00 — unusual hour for field work.` });
        }
      }

      if (isOptIn('fabrication_speed') && fabSuspect.has(id)) {
        push(id, serial, { type: 'fabrication_speed', severity: 'medium', message: `Logged less than 15 seconds after the same surveyor's previous reading. (Note: offline bulk-uploads can also cause this.)` });
      }

      if (isOptIn('duplicate_same_day')) {
        // A duplicate is the same meter, same field DATE, with the SAME reading
        // value — an accidental re-submission. Two reads at different times with
        // different readings are legitimate and never flagged.
        const t = readingTime(sub);
        if (!Number.isNaN(t)) {
          const farm = getField(sub, 'farm') || '';
          const rv = String(getField(sub, 'endReading') ?? getField(sub, 'reading') ?? '').trim();
          const dayKey = `${farm}|${serial}|${new Date(t).toISOString().slice(0, 10)}|${rv}`;
          if (seenDays[dayKey]) {
            push(id, serial, { type: 'duplicate_same_day', severity: 'low', message: `This exact meter (${serial}) already has an identical reading (${rv || '—'}) on ${new Date(t).toISOString().slice(0, 10)}`, previousSubmissionId: seenDays[dayKey], previousDate: new Date(t).toISOString().slice(0, 10) });
          }
          seenDays[dayKey] = id;
        }
      }

      if (i > 0) {
        const prev = list[i - 1];
        const prevEnd = parseReading(getField(prev, 'endReading'));
        const prevTime = readingTime(prev);
        const daysGap = (subTime - prevTime) / MS_PER_DAY;

        if (isOn('out_of_sequence')) {
          const dPrev = readingTime(prev);
          const dCur = readingTime(sub);
          if (!Number.isNaN(dPrev) && !Number.isNaN(dCur) && dCur < dPrev - MS_PER_DAY) {
            push(id, serial, { type: 'out_of_sequence', severity: 'medium', message: `Reading date is earlier than the previous reading's date` });
          }
        }

        if (!Number.isNaN(prevEnd) && !Number.isNaN(endR)) {
          if (isOn('rollback') && endR < prevEnd) {
            push(id, serial, { type: 'rollback', severity: 'high', message: `Reading ${endR} < previous ${prevEnd} (meter cannot go backwards)`, previousReading: prevEnd, previousSubmissionId: prev._id, previousDate: prev._submission_time, currentReading: endR });
          } else if (isOn('huge_jump') && endR - prevEnd > hugeJumpThreshold) {
            push(id, serial, { type: 'huge_jump', severity: 'high', message: `Reading jumped by ${(endR - prevEnd).toLocaleString()} (${prevEnd} -> ${endR}). Likely an extra digit.`, previousReading: prevEnd, previousSubmissionId: prev._id, previousDate: prev._submission_time, currentReading: endR });
          } else if (isOn('growth_anomaly') && med !== null && daysGap > 0) {
            const rate = (endR - prevEnd) / daysGap;
            if (med > 0 && rate > med * anomalyMultiplier && (endR - prevEnd) > 50) {
              push(id, serial, { type: 'growth_anomaly', severity: 'medium', message: `Used ${(endR - prevEnd).toLocaleString()} units in ${daysGap.toFixed(1)} days. Typical is about ${(med * daysGap).toFixed(0)} units - ${(rate / med).toFixed(1)}x higher than usual.`, previousReading: prevEnd, previousSubmissionId: prev._id, previousDate: prev._submission_time, currentReading: endR });
            }
          }

          if (isOptIn('zero_consumption') && daysGap >= 7 && endR === prevEnd && endR > 0) {
            push(id, serial, { type: 'zero_consumption', severity: 'medium', message: `No water used in ${daysGap.toFixed(0)} days (reading stayed at ${endR}). Possible stuck or bypassed meter.` });
          }
        }
      }
    }

    // stale checks + village outlier on the latest reading
    if (list.length > 0) {
      const last = list[list.length - 1];
      const id = last._id;
      const daysSince = (nowDate.getTime() - readingTime(last)) / MS_PER_DAY;
      const lastReading = parseReading(getField(last, 'endReading'));

      if (isOn('stale_no_reading') && daysSince > staleDays) {
        push(id, serial, { type: 'stale_no_reading', severity: 'medium', message: `No reading taken for ${daysSince.toFixed(0)} days on meter ${serial}` });
      }
      if (isOn('stale_unchanged') && list.length >= 3) {
        const a = parseReading(getField(list[list.length - 3], 'endReading'));
        const b = parseReading(getField(list[list.length - 2], 'endReading'));
        const c = lastReading;
        if (!Number.isNaN(a) && !Number.isNaN(b) && !Number.isNaN(c) && a === b && b === c && a > 0) {
          push(id, serial, { type: 'stale_unchanged', severity: 'medium', message: `Reading has not changed across the last 3 submissions (${c}). Meter may be stuck.` });
        }
      }
      if (isOptIn('village_outlier') && villageOutlierLatestId.has(id)) {
        push(id, serial, { type: 'village_outlier', severity: 'medium', message: `This meter's average daily usage is far higher than other meters in the same village.` });
      }
    }
  }

  // Review window: drop flags on OLD readings (taken more than N days ago), so a
  // reading nobody has touched in weeks isn't kept in the red-flag list. Blank
  // / 0 = flag everything. Readings still provide history for comparisons; only
  // the flag on the old row itself is removed.
  const win = Number(flagWindowDays);
  if (Number.isFinite(win) && win > 0) {
    const cutoff = nowDate.getTime() - win * MS_PER_DAY;
    const timeById = {};
    for (const sub of submissions) timeById[String(sub._id)] = readingTime(sub);
    for (const id of Object.keys(flagged)) {
      const t = timeById[id];
      if (t != null && t < cutoff) delete flagged[id];
    }
  }

  return flagged;
}
