import { getMedia } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_request, { params }) {
  const { id } = await params;
  try {
    const m = await getMedia(id);
    if (!m) return new Response('Not found', { status: 404 });
    return new Response(m.buffer, {
      headers: {
        'Content-Type': m.contentType || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (e) {
    return new Response('Error', { status: 500 });
  }
}
