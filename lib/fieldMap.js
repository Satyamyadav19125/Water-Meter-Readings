// =====================================================================
// FIELD MAP — EDIT THIS FILE ONCE AFTER DEPLOYING.
// =====================================================================
//
// Every Kobo form has its own question names. Your form will look
// something like this when we fetch it:
//
//   {
//     "_id": 12345,
//     "village_name": "Sangrur",
//     "wm_serial": "WM10024088531",
//     "start_reading": "00010",
//     "end_reading": "00020",
//     "start_time": "2025-06-02T08:00:00",
//     "end_time": "2025-06-02T08:15:00",
//     "meter_photo": "meter_photo-12_30_45.jpg",
//     "_attachments": [...],
//     "_submission_time": "2025-06-02T08:15:30",
//     ...
//   }
//
// HOW TO FIND YOUR FIELD NAMES:
// 1. After your app is deployed, visit /debug on your site.
// 2. It will show the raw JSON of one submission.
// 3. Find the keys that match each item below and put the exact key
//    name on the right side.
//
// Group prefixes: if your Kobo form uses groups, the keys will look
// like "group_name/field_name" — use the full path with the slash.
// =====================================================================

export const FIELD_MAP = {
  // The village dropdown answer
  village: 'village_name',

  // The water meter serial number
  serial: 'wm_serial',

  // Starting and ending readings (numbers, but Kobo returns them as strings)
  startReading: 'start_reading',
  endReading: 'end_reading',

  // Start and end timestamps the user entered
  startTime: 'start_time',
  endTime: 'end_time',

  // The photo question name (just the question name, not the filename)
  photo: 'meter_photo',

  // GPS location if your form captures it (Kobo "geopoint" type)
  // Leave as null if your form has no location field
  location: 'gps',
};

// Helper: get a value from a submission using the field map.
// Handles missing fields gracefully.
export function getField(submission, key) {
  const path = FIELD_MAP[key];
  if (!path || !submission) return null;
  // Kobo group syntax uses '/' — direct key lookup works either way
  if (path in submission) return submission[path];
  // Try slash-path lookup
  return submission[path] ?? null;
}

// Helper: parse a reading string to a number. Returns NaN if not numeric.
export function parseReading(value) {
  if (value === null || value === undefined || value === '') return NaN;
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : NaN;
}
