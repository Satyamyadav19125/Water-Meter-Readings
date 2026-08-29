import { getMedia } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const name = (searchParams.get('name') || '').replace(/[^\w.\- ]/g, '').slice(0, 100);
  const download = searchParams.get('dl') === '1';
  try {
    const m = await getMedia(id);
    if (!m) return new Response('Not found', { status: 404 });
    const headers = {
      'Content-Type': m.contentType || 'application/octet-stream',
      // Cache in the browser AND on Vercel's edge, so repeat views don't re-hit
      // the function (saves origin transfer, CPU and memory on the free tier).
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Vercel-CDN-Cache-Control': 'public, max-age=31536000, immutable',
    };
    if (name) headers['Content-Disposition'] = `${download ? 'attachment' : 'inline'}; filename="${name}"`;
    return new Response(m.buffer, { headers });
  } catch (e) {
    return new Response('Error', { status: 500 });
  }
}
