import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { getStorageStats, cleanupBefore, isDbConfigured } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  if (!isDbConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 400 });
  try {
    const stats = await getStorageStats();
    return NextResponse.json(stats);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST { what: 'messages' | 'tasks' | 'verifications', before: 'YYYY-MM-DD' }
export async function POST(request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body.what || !body.before) return NextResponse.json({ error: 'what and before are required' }, { status: 400 });
  try {
    const deleted = await cleanupBefore(body.what, body.before);
    return NextResponse.json({ ok: true, deleted });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
