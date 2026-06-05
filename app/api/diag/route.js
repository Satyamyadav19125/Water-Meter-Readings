import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Admin only' }, { status: 401 });
  }

  const rawToken = process.env.KOBO_API_TOKEN || '';
  const cleanedToken = (() => {
    let t = rawToken.trim();
    if (t.toLowerCase().startsWith('token ')) t = t.slice(6).trim();
    t = t.replace(/^["']|["']$/g, '');
    return t;
  })();

  const base = (process.env.KOBO_BASE_URL || 'https://kf.kobotoolbox.org').trim().replace(/\/$/, '');
  const asset = (process.env.KOBO_ASSET_UID || '').trim();

  const diag = {
    env: {
      KOBO_API_TOKEN: rawToken ? {
        rawLength: rawToken.length,
        cleanedLength: cleanedToken.length,
        hadWhitespace: rawToken !== rawToken.trim(),
        hadTokenPrefix: rawToken.trim().toLowerCase().startsWith('token '),
        prefix: cleanedToken.slice(0, 4),
        suffix: cleanedToken.slice(-4),
      } : 'NOT SET',
      KOBO_BASE_URL: base,
      KOBO_ASSET_UID: asset || 'NOT SET',
      MONGODB_URI: process.env.MONGODB_URI ? 'set' : 'NOT SET',
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ? 'set' : 'NOT SET',
      WEBHOOK_SECRET: process.env.WEBHOOK_SECRET ? 'set' : 'NOT SET',
    },
    tests: [],
  };

  if (cleanedToken && asset) {
    try {
      const url = `${base}/api/v2/assets/${asset}/?format=json`;
      const res = await fetch(url, {
        headers: { Authorization: `Token ${cleanedToken}` },
        cache: 'no-store',
      });
      const text = await res.text();
      diag.tests.push({
        name: 'Fetch asset definition',
        url, status: res.status, ok: res.ok,
        snippet: text.slice(0, 200),
      });
    } catch (e) {
      diag.tests.push({ name: 'Fetch asset definition', error: e.message });
    }

    try {
      const url = `${base}/me/?format=json`;
      const res = await fetch(url, {
        headers: { Authorization: `Token ${cleanedToken}` },
        cache: 'no-store',
      });
      const text = await res.text();
      diag.tests.push({
        name: 'Fetch user info (validates token)',
        url, status: res.status, ok: res.ok,
        snippet: text.slice(0, 200),
      });
    } catch (e) {
      diag.tests.push({ name: 'Fetch user info', error: e.message });
    }
  }

  return NextResponse.json(diag, { status: 200 });
}
