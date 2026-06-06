import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getAssignments, saveAssignments } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
  return NextResponse.json({ profile: user });
}

export async function PUT(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
  if (user.role === 'admin') {
    return NextResponse.json({ error: 'Admin profile is fixed. Edit user profiles on the Assignments page.' }, { status: 400 });
  }
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const list = await getAssignments();
  const idx = list.findIndex((u) => u.person === user.name);
  if (idx < 0) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const safe = {};
  if (typeof body.phone === 'string') safe.phone = body.phone;
  if (typeof body.email === 'string') safe.email = body.email;
  if (typeof body.photo === 'string') safe.photo = body.photo;
  if (typeof body.bio === 'string') safe.bio = body.bio;
  if (typeof body.password === 'string' && body.password.length > 0) safe.password = body.password;

  list[idx] = { ...list[idx], ...safe };
  await saveAssignments(list);

  const res = NextResponse.json({ ok: true, passwordChanged: 'password' in safe });
  if ('password' in safe) {
    res.cookies.set('wmd_user', `${user.name}::${safe.password}`, {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
    });
  }
  return res;
}
