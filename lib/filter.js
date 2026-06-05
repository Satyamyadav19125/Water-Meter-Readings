import { getCurrentUser } from './auth.js';
import { getField } from './fieldMap.js';

export async function getAllowedVillages() {
  const user = await getCurrentUser();
  if (!user || user.role === 'admin') return null;
  if (Array.isArray(user.villages) && user.villages.length > 0) {
    return new Set(user.villages);
  }
  if (Array.isArray(user.meters)) {
    const set = new Set(user.meters.map((m) => m.village).filter(Boolean));
    if (set.size > 0) return set;
  }
  return new Set();
}

export async function filterSubmissionsForUser(submissions) {
  const allowed = await getAllowedVillages();
  if (allowed === null) return submissions;
  return submissions.filter((s) => allowed.has(getField(s, 'village')));
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
  const village = (get('village') || '').trim();
  const meter = (get('meter') || '').trim();
  const surveyor = (get('surveyor') || '').trim();
  const from = (get('from') || '').trim();
  const to = (get('to') || '').trim();

  let result = submissions;
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
