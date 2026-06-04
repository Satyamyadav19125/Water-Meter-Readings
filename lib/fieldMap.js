export const FIELD_MAP = {
  village: ['group_1/q2', 'group_1/village_name', 'village_name', 'village'],
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
  for (const path of candidates) {
    if (path == null) continue;
    if (path in submission) {
      const v = submission[path];
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
