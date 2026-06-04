import { getCurrentUser } from './auth.js';
import { getField } from './fieldMap.js';

export async function filterSubmissionsForUser(submissions) {
  const user = await getCurrentUser();
  if (!user || user.role === 'admin') return submissions;
  const allowed = new Set((user.meters || []).map((m) => m.serial));
  if (allowed.size === 0) return [];
  return submissions.filter((s) => allowed.has(getField(s, 'serial')));
}

export async function filterAssignmentsForUser(assignments) {
  const user = await getCurrentUser();
  if (!user) return [];
  if (user.role === 'admin') return assignments;
  return assignments.filter((a) => a.person === user.name);
}
