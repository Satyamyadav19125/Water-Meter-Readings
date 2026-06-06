import { NextResponse } from 'next/server';
import { getSettings, saveSettings, DEFAULT_SETTINGS } from '@/lib/db';
import { isAdmin, getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  const settings = await getSettings();
  if (user?.role === 'admin') return NextResponse.json({ settings });
  const safe = {
    ...settings,
    forms: (settings.forms || []).map((f) => ({ ...f, token: undefined })),
  };
  return NextResponse.json({ settings: safe });
}

export async function PUT(request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Admin only' }, { status: 401 });
  }
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const merged = {
    contact: { ...DEFAULT_SETTINGS.contact, ...(body.contact || {}) },
    redFlags: { ...DEFAULT_SETTINGS.redFlags, ...(body.redFlags || {}) },
    project: { ...DEFAULT_SETTINGS.project, ...(body.project || {}) },
    forms: Array.isArray(body.forms) ? body.forms : [],
  };
  let foundActive = false;
  merged.forms = merged.forms.map((f) => {
    if (f.isActive && !foundActive) { foundActive = true; return f; }
    return { ...f, isActive: false };
  });
  await saveSettings(merged);
  return NextResponse.json({ ok: true });
}
