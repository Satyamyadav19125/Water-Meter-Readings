import { cookies } from 'next/headers';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const COOKIE_NAME = 'wmd_admin';

export async function isAdmin() {
  if (!ADMIN_PASSWORD) return false;
  const store = await cookies();
  const c = store.get(COOKIE_NAME);
  return c?.value === ADMIN_PASSWORD;
}

export function checkPassword(pw) {
  if (!ADMIN_PASSWORD) return false;
  return pw === ADMIN_PASSWORD;
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;
