import { NextResponse } from 'next/server';
import { fetchSubmissions } from '@/lib/kobo';
import { getCurrentUser } from '@/lib/auth';
import { getField, parseReading } from '@/lib/fieldMap';
import { startOfWeek, endOfWeek, daysRemaining, readingDate } from '@/lib/weekly';

export const dynamic = 'force-dynamic';

// Every meter in the user's villages with its read-count + status for a week.
// Week membership uses the reading's DATE field, not its upload time.
//   ?week=this  (default) — the current week
//   ?week=last            — last week
//   ?date=YYYY-MM-DD      — the week CONTAINING that date (admin week picker)
export async function GET(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const weekSel = (searchParams.get('week') || 'this').toLowerCase();
  const dateParam = (searchParams.get('date') || '').trim();

  let submissions = [];
  try {
    submissions = await fetchSubmissions();
  } catch (e) {
    return NextResponse.json({ error: e.message, villages: [] }, { status: 200 });
  }

  let allowed = null;
  if (user.role === 'user') {
    allowed = new Set((user.villages || []).map((v) => String(v).trim().toLowerCase()));
  }

  const now = new Date();
  let ref = weekSel === 'last' ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) : now;
  let mode = weekSel === 'last' ? 'last' : 'this';
  if (dateParam) {
    const t = Date.parse(dateParam);
    if (!Number.isNaN(t)) { ref = new Date(t); mode = 'custom'; }
  }
  const weekStart = startOfWeek(ref);
  const weekEnd = endOfWeek(ref);
  const isCurrentWeek = now.getTime() >= weekStart.getTime() && now.getTime() < weekEnd.getTime();

  const meters = {};
  for (const s of submissions) {
    const serial = getField(s, 'serial');
    if (!serial) continue;
    const village = getField(s, 'village') || 'Unknown';
    if (allowed && !allowed.has(String(village).trim().toLowerCase())) continue;

    const key = `${village}|||${serial}`;
    if (!meters[key]) {
      meters[key] = { serial, village, countThisWeek: 0, lastReading: null, lastDate: null, lastSurveyor: null, lastTs: 0 };
    }
    const m = meters[key];

    // Week membership is decided by the reading DATE, not the upload time.
    const rt = readingDate(s).getTime();
    if (!Number.isNaN(rt) && rt >= weekStart.getTime() && rt < weekEnd.getTime()) {
      m.countThisWeek += 1;
    }
    // "Last reading" still tracks the most recently uploaded reading overall.
    const upTs = new Date(s._submission_time).getTime();
    if (!Number.isNaN(upTs) && upTs > m.lastTs) {
      m.lastTs = upTs;
      const r = parseReading(getField(s, 'endReading'));
      m.lastReading = Number.isNaN(r) ? null : r;
      m.lastDate = s._submission_time;
      m.lastSurveyor = getField(s, 'surveyor') || null;
    }
  }

  const byVillage = {};
  for (const key in meters) {
    const m = meters[key];
    const status = m.countThisWeek >= 2 ? 'done' : m.countThisWeek === 1 ? 'partial' : 'pending';
    const row = { serial: m.serial, countThisWeek: m.countThisWeek, status, lastReading: m.lastReading, lastDate: m.lastDate, lastSurveyor: m.lastSurveyor };
    if (!byVillage[m.village]) byVillage[m.village] = [];
    byVillage[m.village].push(row);
  }

  const villages = Object.keys(byVillage).sort().map((village) => {
    const list = byVillage[village].sort((a, b) => a.serial.localeCompare(b.serial));
    return {
      village, meters: list,
      done: list.filter((x) => x.status === 'done').length,
      partial: list.filter((x) => x.status === 'partial').length,
      pending: list.filter((x) => x.status === 'pending').length,
      total: list.length,
    };
  });

  const totals = villages.reduce(
    (acc, v) => ({ done: acc.done + v.done, partial: acc.partial + v.partial, pending: acc.pending + v.pending, total: acc.total + v.total }),
    { done: 0, partial: 0, pending: 0, total: 0 }
  );

  return NextResponse.json({
    villages, totals,
    week: mode,
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    daysLeft: isCurrentWeek ? daysRemaining(now) : 0,
    isCurrentWeek,
    role: user.role,
  });
}
