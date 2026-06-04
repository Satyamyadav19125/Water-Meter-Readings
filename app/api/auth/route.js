import { NextResponse } from 'next/server';
import { checkAdminPassword, ADMIN_COOKIE, USER_COOKIE } from '@/lib/auth';
import { getAssignments } from '@/lib/db';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { username, password, action } = body;

  if (action === 'logout') {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_COOKIE, '', { maxAge: 0, path: '/' });
    res.cookies.set(USER_COOKIE, '', { maxAge: 0, path: '/' });
    return res;
  }

  const cookieOpts = {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
  };

  if (!username || !username.trim()) {
    if (!checkAdminPassword(password)) {
      return NextResponse.json({ error: 'Incorrect admin password' }, { status: 401 });
    }
    const res = NextResponse.json({ ok: true, role: 'admin' });
    res.cookies.set(ADMIN_COOKIE, password, cookieOpts);
    res.cookies.set(USER_COOKIE, '', { maxAge: 0, path: '/' });
    return res;
  }

  const name = username.trim();
  try {
    const list = await getAssignments();
    const user = list.find((u) => u.person === name);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 401 });
    if (!user.password) return NextResponse.json({ error: 'No password set for this user. Ask the admin to set one.' }, { status: 401 });
    if (user.password !== password) return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
    const res = NextResponse.json({ ok: true, role: 'user', name: user.person });
    res.cookies.set(USER_COOKIE, `${user.person}::${password}`, cookieOpts);
    res.cookies.set(ADMIN_COOKIE, '', { maxAge: 0, path: '/' });
    return res;
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
