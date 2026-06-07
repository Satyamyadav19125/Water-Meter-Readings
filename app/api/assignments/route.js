import { NextResponse } from 'next/server';
import { getAssignments, saveAssignments, isDbConfigured } from '@/lib/db';
import { isAdmin } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: 'Database not configured. Add MONGODB_URI in Vercel → Settings → Environment Variables.' },
      { status: 500 }
    );
  }
  try {
    const list = await getAssignments();
    return NextResponse.json({ assignments: list });
  } catch (e) {
    return NextResponse.json({ error: e.message, assignments: [] }, { status: 200 });
  }
}

export async function PUT(request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Not authorized. Please log in.' }, { status: 401 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!Array.isArray(body?.assignments)) {
    return NextResponse.json({ error: 'Expected { assignments: [...] }' }, { status: 400 });
  }
  try {
    await saveAssignments(body.assignments);
    revalidatePath('/');
    revalidatePath('/submissions');
    revalidatePath('/usage');
    return NextResponse.json({ ok: true, count: body.assignments.length });
  } catch (e) {
    return NextResponse.json(
      { error: `Could not save: ${e.message}. This usually means the database password in MONGODB_URI is wrong.` },
      { status: 500 }
    );
  }
}
