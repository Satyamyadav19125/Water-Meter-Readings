import { getField } from './fieldMap.js';

// One GPS helper: Kobo stores "lat lng altitude accuracy" in one string.
function gpsParts(s) {
  const parts = String(getField(s, 'location') || '').trim().split(/\s+/);
  return {
    latlng: parts.length >= 2 ? `${parts[0]} ${parts[1]}` : '',
    alt: parts[2] || '',
    acc: parts[3] || '',
  };
}

// Every question the surveyor fills, in form order. GPS is split: lat+lng
// stay together in one column; altitude and accuracy get their own.
const COLUMNS = [
  { key: 'id', label: 'Submission ID', get: (s) => s._id },
  { key: 'time', label: 'Submitted At', get: (s) => s._submission_time },
  { key: 'village', label: 'Village', get: (s) => getField(s, 'village') },
  { key: 'farm', label: 'Farm ID', get: (s) => getField(s, 'farm') },
  { key: 'serial', label: 'Meter ID', get: (s) => getField(s, 'serial') },
  { key: 'reading', label: 'Reading', get: (s) => getField(s, 'endReading') ?? getField(s, 'reading') },
  { key: 'surveyor', label: 'Surveyor', get: (s) => getField(s, 'surveyor') },
  { key: 'date', label: 'Form Date', get: (s) => getField(s, 'date') },
  { key: 'start', label: 'Start Time', get: (s) => getField(s, 'startTime') },
  { key: 'end', label: 'End Time', get: (s) => getField(s, 'endTime') },
  { key: 'gps', label: 'GPS (lat lng)', get: (s) => gpsParts(s).latlng },
  { key: 'alt', label: 'Altitude (m)', get: (s) => gpsParts(s).alt },
  { key: 'acc', label: 'GPS Accuracy (m)', get: (s) => gpsParts(s).acc },
  { key: 'photos', label: 'Photos', get: (s) => (s._attachments || []).filter((a) => !a.is_deleted).length },
];

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(submissions) {
  const header = COLUMNS.map((c) => csvEscape(c.label)).join(',');
  const rows = submissions.map((s) => COLUMNS.map((c) => csvEscape(c.get(s))).join(','));
  return [header, ...rows].join('\n');
}

export function toJson(submissions) {
  return submissions.map((s) => {
    const row = {};
    for (const c of COLUMNS) row[c.key] = c.get(s);
    return row;
  });
}


// ---------------------------------------------------------------------------
// Summary statistics for the XLSX export's second sheet: overall + per-village
// totals, averages, min/max — computed from whatever rows are being exported.
// ---------------------------------------------------------------------------
export function buildSummary(submissions) {
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
  const overallVals = [];
  const villages = new Map(); // village -> { readings, pipes:Set, vals:[], lastTs }
  let firstTs = null, lastTs = null;

  for (const s of submissions) {
    const village = getField(s, 'village') || 'Unknown';
    const serial = getField(s, 'serial') || '';
    const val = num(getField(s, 'endReading') ?? getField(s, 'reading'));
    const ts = s._submission_time || '';
    if (!villages.has(village)) villages.set(village, { readings: 0, pipes: new Set(), farms: new Set(), vals: [], lastTs: '' });
    const v = villages.get(village);
    v.readings += 1;
    if (serial) v.pipes.add(serial);
    { const f = getField(s, 'farm'); if (f) v.farms.add(f); }
    if (val != null) { v.vals.push(val); overallVals.push(val); }
    if (ts) {
      if (!firstTs || ts < firstTs) firstTs = ts;
      if (!lastTs || ts > lastTs) lastTs = ts;
      if (ts > v.lastTs) v.lastTs = ts;
    }
  }

  const stats = (vals) => vals.length === 0
    ? { avg: null, min: null, max: null }
    : { avg: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10,
        min: Math.min(...vals), max: Math.max(...vals) };

  const allPipes = new Set();
  for (const v of villages.values()) for (const pIt of v.pipes) allPipes.add(pIt);
  const o = stats(overallVals);

  const farmsWithReadings = new Set();
  for (const s of submissions) { const f = getField(s, 'farm'); if (f) farmsWithReadings.add(f); }

  const overall = [
    ['Total readings', submissions.length],
    ['Distinct farms read', farmsWithReadings.size],
    ['Distinct meters read', allPipes.size],
    ['Total villages', villages.size],
    ['Average reading', o.avg ?? '—'],
    ['Lowest reading', o.min ?? '—'],
    ['Highest reading', o.max ?? '—'],
    ['First submission', firstTs || '—'],
    ['Latest submission', lastTs || '—'],
  ];

  const perVillage = Array.from(villages.entries())
    .sort((a, b) => b[1].readings - a[1].readings)
    .map(([name, v]) => {
      const st = stats(v.vals);
      return {
        village: name, readings: v.readings, farms: v.farms.size, pipes: v.pipes.size,
        avg: st.avg ?? '—', min: st.min ?? '—', max: st.max ?? '—',
        last: v.lastTs ? v.lastTs.slice(0, 10) : '—',
      };
    });

  return { overall, perVillage };
}


// Rows as { 'Column Label': value } objects — the XLSX data sheet uses this
// directly, so it always matches the CSV columns exactly.
export function toLabeledRows(submissions) {
  return submissions.map((s) => {
    const row = {};
    for (const c of COLUMNS) row[c.label] = c.get(s) ?? '';
    return row;
  });
}

// Generic CSV from an array of {label: value} objects (used by the Clean and
// Corrected exports, which have their own column sets).
export function objectsToCsv(rows) {
  if (!rows || rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const head = headers.map(csvEscape).join(',');
  const body = rows.map((r) => headers.map((h) => csvEscape(r[h])).join(','));
  return [head, ...body].join('\n');
}

// CLEAN tab download — exactly the columns the field team asked for:
// Date, Surveyor, Village, Farm ID, Meter ID, Reading, Longitude, Latitude,
// and the submission's unique ID.
export function toCleanLabeledRows(submissions) {
  return submissions.map((s) => {
    const parts = String(getField(s, 'location') || '').trim().split(/\s+/);
    const lat = parts[0] || '';
    const lng = parts[1] || '';
    return {
      'Date': getField(s, 'date') ?? '',
      'Surveyor': getField(s, 'surveyor') ?? '',
      'Village': getField(s, 'village') ?? '',
      'Farm ID': getField(s, 'farm') ?? '',
      'Meter ID': getField(s, 'serial') ?? '',
      'Reading': getField(s, 'endReading') ?? getField(s, 'reading') ?? '',
      'Longitude': lng,
      'Latitude': lat,
      'Submission UID': s._id,
    };
  });
}

function prettyPath(path) {
  const seg = String(path).split('/').pop().toLowerCase();
  const map = {
    reading: 'Reading', meter_id: 'Meter ID', meter: 'Meter ID',
    farm: 'Farm ID', village: 'Village', q2: 'Village',
    name: 'Surveyor', m_name: 'Surveyor',
    date: 'Date', location: 'GPS', start_time: 'Start time', end_time: 'End time',
  };
  return map[seg] || String(path).split('/').pop().replace(/_/g, ' ');
}

// CORRECTED tab download — one row per changed field showing OLD → NEW so you
// can see exactly what changed and why. `rawById` maps submissionId -> the
// original (un-corrected) Kobo row, so old values are the true originals.
export function toCorrectedChangeRows(submissions, rawById = new Map()) {
  const rows = [];
  for (const s of submissions) {
    const c = s._correction;
    if (!c || c.field === 'dead') continue;
    const raw = rawById.get(String(s._id)) || {};
    const when = c.at ? new Date(c.at).toLocaleString() : '';
    const base = { 'Submission UID': s._id, 'Meter ID': getField(raw, 'serial') ?? getField(s, 'serial') ?? '', 'Village': getField(raw, 'village') ?? '' };
    if (c.field === 'fields' && c.fields && typeof c.fields === 'object') {
      for (const [path, val] of Object.entries(c.fields)) {
        rows.push({ ...base, 'Field changed': prettyPath(path), 'Old value (raw Kobo)': raw[path] ?? '', 'New value (corrected)': val ?? '', 'Reason': c.note || '', 'By': c.by || '', 'When': when });
      }
    } else {
      rows.push({ ...base, 'Field changed': 'Reading', 'Old value (raw Kobo)': c.oldValue ?? '', 'New value (corrected)': c.newValue ?? '', 'Reason': c.note || '', 'By': c.by || '', 'When': when });
    }
  }
  return rows;
}
