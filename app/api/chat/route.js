import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getMessages, sendMessage } from '@/lib/chat';

export const dynamic = 'force-dynamic';

// Who is allowed in a channel?
//   'group'        -> any logged-in user (all admins + all assistants)
//   'dm:<name>'    -> any admin, OR the assistant whose name === <name>
function canAccess(user, channel) {
  if (!channel) return false;
  if (channel === 'group') return true;
  if (channel.startsWith('dm:')) {
    const who = channel.slice(3);
    if (user.role === 'admin') return true;
    return String(user.name).toLowerCase() === String(who).toLowerCase();
  }
  return false;
}

function senderIdOf(user) {
  return user.role === 'admin' ? (user.adminId || 'admin') : user.name;
}

export async function GET(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const channel = searchParams.get('channel') || 'group';
  if (!canAccess(user, channel)) return NextResponse.json({ error: 'No access to this chat' }, { status: 403 });

  const messages = await getMessages(channel);
  return NextResponse.json({ messages, me: senderIdOf(user) });
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const channel = body.channel || 'group';
  if (!canAccess(user, channel)) return NextResponse.json({ error: 'No access to this chat' }, { status: 403 });
  const hasText = body.text && String(body.text).trim();
  const hasImage = typeof body.imageUrl === 'string' && body.imageUrl.startsWith('/api/media/');
  if (!hasText && !hasImage) return NextResponse.json({ error: 'Empty message' }, { status: 400 });

  const msg = await sendMessage({
    channel,
    senderId: senderIdOf(user),
    senderName: user.name || (user.role === 'admin' ? 'Admin' : 'Unknown'),
    senderRole: user.role,
    text: body.text,
    imageUrl: body.imageUrl,
  });
  if (!msg) return NextResponse.json({ error: 'Could not send (database unavailable)' }, { status: 503 });
  return NextResponse.json({ message: msg });
}
