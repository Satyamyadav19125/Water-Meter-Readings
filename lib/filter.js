import { getCurrentUser } from './auth.js';
import { getField } from './fieldMap.js';
import { readingDate } from './weekly.js';
import { getDisabledRegistry } from './db.js';

const lc = (v) => String(v || '').trim().toLowerCase();

/**
 * Villages this user may see. null = all (admin).
 */
/**
 * Data views.
 * - NOT logged in: sees NOTHING.
 * - Admin: sees EVERYTHING.
 * - Field assistant: sees only their OWN readings (surveyor name match),
 *   AND only inside their ASSIGNED villages. A reading they made in a
 *   village that is not assigned to them (e.g. helping out elsewhere)
 *   stays visible to the admin but is hidden from their own dashboard.
 */
export async function filterSubmissionsForUser(submissions) {
  const user = await getCurrentUser();
  if (!user) return [];
  if (user.role === 'admin') return submissions;
  // Guest (read-only viewer): the REAL submissions, most-recent first, capped to
  // the admin's "max readings" so guests see a limited real sample (not fakes).
  if (user.role === 'guest') {
    const cap = Math.max(1, Number(user.maxReadings) || 10);
    return [...(submissions || [])]
      .sort((a, b) => new Date(b._submission_time) - new Date(a._submission_time))
      .slice(0, cap);
  }
  const me = lc(user.name);
  if (!me) return [];
  const allowed = Array.isArray(user.villages) && user.villages.length > 0
    ? new Set(user.villages.map(lc))
    : null;
  const reg = await getDisabledRegistry();
  const offFarms = new Set((reg.farms || []).map(lc));
  const offPipes = new Set((reg.pipes || []).map(lc));
  return submissions.filter((s) => {
    if (s._dead) return false; // readings marked "dead" by an admin are hidden
    if (lc(getField(s, 'surveyor')) !== me) return false;
    if (allowed && !allowed.has(lc(getField(s, 'village')))) return false;
    // Disabled farms/pipes are hidden from surveyors entirely.
    if (offFarms.has(lc(getField(s, 'farm')))) return false;
    if (offPipes.has(lc(getField(s, 'serial')))) return false;
    return true;
  });
}

// Filter out submissions belonging to disabled farms/pipes, AND readings an
// admin marked "dead" (submitted by mistake). Used by the red-flag pass,
// coverage, map and analytics so those readings never flag, count as missed,
// or distort the data — while still existing on Kobo and in the admin list.
export async function excludeDisabled(submissions) {
  const reg = await getDisabledRegistry();
  const offFarms = new Set((reg.farms || []).map(lc));
  const offPipes = new Set((reg.pipes || []).map(lc));
  const noReg = offFarms.size === 0 && offPipes.size === 0;
  return submissions.filter((s) => {
    if (s._dead) return false;
    if (noReg) return true;
    return !offFarms.has(lc(getField(s, 'farm'))) && !offPipes.has(lc(getField(s, 'serial')));
  });
}

export async function filterAssignmentsForUser(assignments) {
  const user = await getCurrentUser();
  if (!user) return [];
  if (user.role === 'admin') return assignments;
  if (user.role === 'guest') return assignments; // guest sees the real team (read-only)
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
  const farm = (get('farm') || '').trim();
  const meter = (get('meter') || '').trim();
  const surveyor = (get('surveyor') || '').trim();
  const from = (get('from') || '').trim();
  const to = (get('to') || '').trim();

  let result = submissions;
  // UID search: exact OR partial (so typing part of a submission ID still finds it).
  if (id) { const q = String(id).trim().toLowerCase(); result = result.filter((s) => String(s._id).toLowerCase().includes(q)); }
  if (village) result = result.filter((s) => getField(s, 'village') === village);
  if (farm) result = result.filter((s) => getField(s, 'farm') === farm);
  if (meter) result = result.filter((s) => getField(s, 'serial') === meter);
  if (surveyor) result = result.filter((s) => getField(s, 'surveyor') === surveyor);
  if (from) {
    const fromTs = Date.parse(from);
    if (!Number.isNaN(fromTs)) result = result.filter((s) => readingDate(s).getTime() >= fromTs);
  }
  if (to) {
    const toTs = Date.parse(to);
    if (!Number.isNaN(toTs)) {
      const endOfDay = toTs + 24 * 60 * 60 * 1000 - 1;
      // Use the reading's form date, same as `from`, so a date range is
      // consistent (was mixing form date with upload time).
      result = result.filter((s) => readingDate(s).getTime() <= endOfDay);
    }
  }
  return result;
}
