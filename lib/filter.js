import { getCurrentUser } from './auth.js';
import { getField } from './fieldMap.js';

/**
 * Villages this user may see. null = all (admin).
 * (Used by the weekly meter-status tracker, which is about meter COVERAGE.)
 */
export async function getAllowedVillages() {
  const user = await getCurrentUser();
  if (!user) return new Set(); // not logged in -> nothing
  if (user.role === 'admin') return null;
  if (Array.isArray(user.villages) && user.villages.length > 0) {
    return new Set(user.villages.map((v) => String(v).trim().toLowerCase()));
  }
  return new Set();
}

/**
 * Data views (Overview, Submissions, Usage, Map, Kobo view, Meter, red flags).
 * - NOT logged in: sees NOTHING. (Security: previously anonymous visitors
 *   could open /submissions, /map, /api/export etc. and see ALL data.)
 * - Admin: sees EVERYTHING (all surveyors).
 * - Field assistant: sees ONLY their OWN readings, matched by surveyor name
 *   (case-insensitive) against the Kobo "M Name" field. They never see another
 *   surveyor's submissions, even in their own village.
 */
export async function filterSubmissionsForUser(submissions) {
  const user = await getCurrentUser();
  if (!user) return [];
  if (user.role === 'admin') return submissions;
  const me = String(user.name || '').trim().toLowerCase();
  if (!me) return [];
  return submissions.filter(
    (s) => String(getField(s, 'surveyor') || '').trim().toLowerCase() === me
  );
}

export async function filterAssignmentsForUser(assignments) {
  const user = await getCurrentUser();
  if (!user) return [];
  if (user.role === 'admin') return assignments;
  return assignments.filter((a) => a.person === user.name);
}

export function applyUrlFilters(submissions, searchParams) {
  if (!searchParams) return submissions;
  const get = (k) => {
    if (typeof searchParams.get === 'function') return searchParams.get(k);
    return searchParams[k];
  };
  const id = (get('id') || '').trim();
  const village = (get('village') || '').trim();
  const meter = (get('meter') || '').trim();
  const surveyor = (get('surveyor') || '').trim();
  const from = (get('from') || '').trim();
  const to = (get('to') || '').trim();

  let result = submissions;
  if (id) result = result.filter((s) => String(s._id) === id);
  if (village) result = result.filter((s) => getField(s, 'village') === village);
  if (meter) result = result.filter((s) => getField(s, 'serial') === meter);
  if (surveyor) result = result.filter((s) => getField(s, 'surveyor') === surveyor);
  if (from) {
    const fromTs = Date.parse(from);
    if (!Number.isNaN(fromTs)) result = result.filter((s) => new Date(s._submission_time).getTime() >= fromTs);
  }
  if (to) {
    const toTs = Date.parse(to);
    if (!Number.isNaN(toTs)) {
      const endOfDay = toTs + 24 * 60 * 60 * 1000 - 1;
      result = result.filter((s) => new Date(s._submission_time).getTime() <= endOfDay);
    }
  }
  return result;
}
