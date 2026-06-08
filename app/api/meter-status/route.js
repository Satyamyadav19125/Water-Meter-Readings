import { NextResponse } from 'next/server';
import { fetchSubmissions } from '@/lib/kobo';
import { getCurrentUser } from '@/lib/auth';
import { getField, parseReading } from '@/lib/fieldMap';
import { startOfWeek, endOfWeek, daysRemaining } from '@/lib/weekly';

export const dynamic = 'force-dynamic';

// Returns every meter in the user's assigned villages with its weekly
// read-count + status (done >=2, partial =1, pending =0).
// Each meter must be read TWICE per week. Any surveyor's reading counts.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

  let submissions = [];
  try {
    submissions = await fetchSubmissions();
  } catch (e) {
    return NextResponse.json({ error: e.message, villages: [] }, { status: 200 });
  }

  // Scope: admin sees all villages; a field assistant sees ONLY their villages.
  let allowed = null; // null = all
  if (user.role === 'user') {
    allowed = new Set((user.villages || []).map((v) => String(v).trim().toLowerCase()));
  }

  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);

  // meterKey -> aggregate
  const meters = {};
  for (const s of submissions) {
    const serial = getField(s, 'serial');
    if (!serial) continue;
    const village = getField(s, 'village') || 'Unknown';
    if (allowed && !allowed.has(String(village).trim().toLowerCase())) continue;

    const key = `${village}|||${serial}`;
    if (!meters[key]) {
      meters[key] = {
        serial, village,
        countThisWeek: 0,
        lastReading: null, lastDate: null, lastSurveyor: null, lastTs: 0,
      };
    }
    const m = meters[key];

    const t = new Date(s._submission_time).getTime();
    if (!Number.isNaN(t) && t >= weekStart.getTime() && t < weekEnd.getTime()) {
      m.countThisWeek += 1;
    }
    if (!Number.isNaN(t) && t > m.lastTs) {
      m.lastTs = t;
      const r = parseReading(getField(s, 'endReading'));
      m.lastReading = Number.isNaN(r) ? null : r;
      m.lastDate = s._submission_time;
      m.lastSurveyor = getField(s, 'surveyor') || null;
    }
  }

  // Group by village
  const byVillage = {};
  for (const key in meters) {
    const m = meters[key];
    const status = m.countThisWeek >= 2 ? 'done' : m.countThisWeek === 1 ? 'partial' : 'pending';
    const row = {
      serial: m.serial,
      countThisWeek: m.countThisWeek,
      status,
      lastReading: m.lastReading,
      lastDate: m.lastDate,
      lastSurveyor: m.lastSurveyor,
    };
    if (!byVillage[m.village]) byVillage[m.village] = [];
    byVillage[m.village].push(row);
  }

  const villages = Object.keys(byVillage).sort().map((village) => {
    const list = byVillage[village].sort((a, b) => a.serial.localeCompare(b.serial));
    return {
      village,
      meters: list,
      done: list.filter((x) => x.status === 'done').length,
      partial: list.filter((x) => x.status === 'partial').length,
      pending: list.filter((x) => x.status === 'pending').length,
      total: list.length,
    };
  });

  const totals = villages.reduce(
    (acc, v) => ({
      done: acc.done + v.done, partial: acc.partial + v.partial,
      pending: acc.pending + v.pending, total: acc.total + v.total,
    }),
    { done: 0, partial: 0, pending: 0, total: 0 }
  );

  return NextResponse.json({
    villages,
    totals,
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    daysLeft: daysRemaining(now),
    role: user.role,
  });
}
