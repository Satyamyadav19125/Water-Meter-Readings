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
    reading: { ...DEFAULT_SETTINGS.reading, ...(body.reading || {}) },
  };
  // Sanity-clamp: target 1..50, periodDays 1..365, photo 200..3000 px.
  const r = merged.reading;
  r.target = Math.max(1, Math.min(50, Math.round(Number(r.target) || 2)));
  r.periodDays = Math.max(1, Math.min(365, Math.round(Number(r.periodDays) || 7)));
  r.photoMaxPx = Math.max(200, Math.min(3000, Math.round(Number(r.photoMaxPx) || 1600)));
  r.photoQuality = Math.max(0.4, Math.min(0.98, Number(r.photoQuality) || 0.85));
  r.profilePhotoMaxPx = Math.max(200, Math.min(2000, Math.round(Number(r.profilePhotoMaxPx) || 600)));
  r.profilePhotoQuality = Math.max(0.4, Math.min(0.98, Number(r.profilePhotoQuality) || 0.88));
  let foundActive = false;
  merged.forms = merged.forms.map((f) => {
    if (f.isActive && !foundActive) { foundActive = true; return f; }
    return { ...f, isActive: false };
  });
  await saveSettings(merged);
  return NextResponse.json({ ok: true });
}
