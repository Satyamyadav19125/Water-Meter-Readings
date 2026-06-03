import { NextResponse } from 'next/server';
import { checkPassword, ADMIN_COOKIE_NAME } from '@/lib/auth';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { password, action } = body;

  if (action === 'logout') {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_COOKIE_NAME, '', { maxAge: 0, path: '/' });
    return res;
  }

  if (!checkPassword(password)) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, password, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
