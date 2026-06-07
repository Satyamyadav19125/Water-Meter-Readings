// =====================================================================
// FIELD MAP — robust, CASE-INSENSITIVE matching.
//
// Your real Kobo keys (from /debug):
//   group_1/Q2          -> village   (NOTE: capital Q)
//   group_2/meter_id    -> serial
//   group_2/reading     -> reading
//   group_1/m_name      -> surveyor
//   group_2/location    -> GPS
//   group_2/photo_reading -> photo
//   group_1/date        -> date
//
// getField now matches regardless of upper/lowercase AND can match on
// just the last path segment, so small form changes won't break it.
// =====================================================================

export const FIELD_MAP = {
  village: ['group_1/Q2', 'group_1/q2', 'group_1/village_name', 'Q2', 'q2', 'village_name', 'village'],
  serial:  ['group_2/meter_id', 'meter_id', 'wm_serial', 'serial'],

  reading:      ['group_2/reading', 'reading', 'meter_reading'],
  startReading: ['group_2/start_reading', 'start_reading', 'reading_start'],
  endReading:   ['group_2/reading', 'group_2/end_reading', 'end_reading', 'reading'],

  startTime: ['group_1/start_time', 'start_time'],
  endTime:   ['group_1/end_time', 'end_time'],
  date:      ['group_1/date', 'date'],

  photo:    ['group_2/photo_reading', 'meter_photo', 'photo'],
  location: ['group_2/location', 'gps', '_geolocation'],

  surveyor: ['group_1/m_name', 'm_name', 'surveyor_name', 'surveyor'],
};

export function getField(submission, key) {
  if (!submission) return null;
  const conf = FIELD_MAP[key];
  if (!conf) return null;
  const candidates = Array.isArray(conf) ? conf : [conf];

  // 1) Exact match
  for (const path of candidates) {
    if (path == null) continue;
    if (path in submission) {
      const v = submission[path];
      if (v !== null && v !== undefined && v !== '') return v;
    }
  }

  // 2) Case-insensitive full-key match
  const wantLower = candidates.map((c) => String(c).toLowerCase());
  for (const k in submission) {
    if (wantLower.includes(k.toLowerCase())) {
      const v = submission[k];
      if (v !== null && v !== undefined && v !== '') return v;
    }
  }

  // 3) Last-path-segment match (e.g. ".../Q2" matches "q2")
  const wantSeg = candidates.map((c) => String(c).split('/').pop().toLowerCase());
  for (const k in submission) {
    const seg = k.split('/').pop().toLowerCase();
    if (wantSeg.includes(seg)) {
      const v = submission[k];
      if (v !== null && v !== undefined && v !== '') return v;
    }
  }

  return null;
}

export function parseReading(value) {
  if (value === null || value === undefined || value === '') return NaN;
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : NaN;
}
