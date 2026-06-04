import { cookies } from 'next/headers';
import { getAssignments } from './db.js';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
export const ADMIN_COOKIE = 'wmd_admin';
export const USER_COOKIE = 'wmd_user';

export async function getCurrentUser() {
  const store = await cookies();
  const adminC = store.get(ADMIN_COOKIE);
  if (adminC?.value && ADMIN_PASSWORD && adminC.value === ADMIN_PASSWORD) {
    return { role: 'admin' };
  }
  const userC = store.get(USER_COOKIE);
  if (userC?.value) {
    const idx = userC.value.indexOf('::');
    if (idx > 0) {
      const name = userC.value.slice(0, idx);
      const token = userC.value.slice(idx + 2);
      try {
        const list = await getAssignments();
        const user = list.find((u) => u.person === name);
        if (user && user.password && user.password === token) {
          return {
            role: 'user',
            name: user.person,
            meters: user.meters || [],
            phone: user.phone || null,
            email: user.email || null,
          };
        }
      } catch {}
    }
  }
  return null;
}

export async function isAdmin() {
  const u = await getCurrentUser();
  return u?.role === 'admin';
}

export function checkAdminPassword(pw) {
  if (!ADMIN_PASSWORD) return false;
  return pw === ADMIN_PASSWORD;
}
