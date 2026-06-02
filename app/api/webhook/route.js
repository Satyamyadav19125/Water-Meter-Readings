// =====================================================================
// Webhook receiver: Kobo POSTs to this URL when a new submission arrives.
// We verify the shared secret, then revalidate cached pages.
// =====================================================================

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export async function POST(request) {
  const url = new URL(request.url);
  const provided = url.searchParams.get('secret') || request.headers.get('x-webhook-secret');
  const expected = process.env.WEBHOOK_SECRET;

  if (!expected || provided !== expected) {
    return NextResponse.json({ error: 'invalid secret' }, { status: 401 });
  }

  let body = null;
  try {
    body = await request.json();
  } catch {
    // Kobo may POST form-encoded; we don't actually need the body
    body = null;
  }

  // Force the cached pages to refresh on next visit
  revalidatePath('/');
  revalidatePath('/dashboard');
  revalidatePath('/kobo-view');
  revalidatePath('/debug');

  console.log('[webhook] received submission', body?._id || '(no id)');
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({
    message: 'Water meter webhook is alive. Kobo should POST here with ?secret=YOUR_WEBHOOK_SECRET',
  });
}
