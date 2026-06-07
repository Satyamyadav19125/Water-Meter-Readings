import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { saveMedia, isDbConfigured } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Upload a resized base64 image; returns a URL you can store in a photo field.
export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
  if (!isDbConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 400 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body.dataUrl) return NextResponse.json({ error: 'No image provided' }, { status: 400 });
  try {
    const id = await saveMedia(body.dataUrl);
    return NextResponse.json({ ok: true, id, url: `/api/media/${id}` });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
