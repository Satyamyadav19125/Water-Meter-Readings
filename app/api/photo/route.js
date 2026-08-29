// =====================================================================
// Photo proxy: Kobo attachments need the API token for access.
// We can't put the token in <img src=...>, so we proxy via this route.
// =====================================================================

import { fetchAttachmentStream } from '@/lib/kobo';

const ALLOWED_HOSTS = new Set([
  'kc.kobotoolbox.org',
  'kf.kobotoolbox.org',
  'kobo.humanitarianresponse.info',
]);

// A Kobo attachment at a given URL never changes its content, so cache it hard.
// `Vercel-CDN-Cache-Control` makes Vercel's EDGE keep the image for a year, so
// after the first fetch every later view is served from the edge — it does NOT
// re-hit the serverless function or count as "Fast Origin Transfer" (the free
// tier's tightest limit). `Cache-Control` caches it in the visitor's browser
// too, so repeat scrolls don't even reach the network.
const IMG_CACHE = 'public, max-age=31536000, immutable';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get('url');
  if (!target) {
    return new Response('Missing url parameter', { status: 400 });
  }

  // Demo (guest) photos are inline data: URIs — decode and return them directly.
  // Handles any params (e.g. ;utf8, ;charset=..., ;base64) before the comma.
  if (target.startsWith('data:')) {
    const comma = target.indexOf(',');
    if (comma > 0) {
      const meta = target.slice(5, comma);            // e.g. "image/svg+xml;utf8"
      const data = target.slice(comma + 1);
      const ct = meta.split(';')[0] || 'application/octet-stream';
      const isB64 = /;base64/i.test(meta);
      const body = isB64 ? Buffer.from(data, 'base64') : Buffer.from(decodeURIComponent(data), 'utf8');
      return new Response(body, { status: 200, headers: { 'content-type': ct, 'cache-control': IMG_CACHE, 'vercel-cdn-cache-control': IMG_CACHE } });
    }
    return new Response('Bad data URI', { status: 400 });
  }

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return new Response('Invalid url', { status: 400 });
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return new Response('Host not allowed', { status: 403 });
  }

  try {
    const upstream = await fetchAttachmentStream(target);
    const headers = new Headers();
    const ct = upstream.headers.get('content-type') || 'application/octet-stream';
    headers.set('content-type', ct);
    const len = upstream.headers.get('content-length');
    if (len) headers.set('content-length', len);
    // Long-lived edge + browser cache — the big saving on Vercel origin transfer.
    headers.set('cache-control', IMG_CACHE);
    headers.set('vercel-cdn-cache-control', IMG_CACHE);
    return new Response(upstream.body, { status: 200, headers });
  } catch (e) {
    return new Response(`Upstream error: ${e.message}`, { status: 502 });
  }
}
