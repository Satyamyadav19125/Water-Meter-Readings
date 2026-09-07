import { NextResponse } from 'next/server';
import { fetchSubmissions, fetchFormMaster } from '@/lib/kobo';
import { getCurrentUser } from '@/lib/auth';
import { getSettings, getDisabledRegistry } from '@/lib/db';
import { getField, parseReading } from '@/lib/fieldMap';
import { startOfWeek, endOfWeek, daysRemaining, readingDate } from '@/lib/weekly';

export const dynamic = 'force-dynamic';

// Every meter in the user's villages with its read-count + status for a period.
// Period membership uses the reading's DATE field, not its upload time.
//   ?week=this  (default) — the current period
//   ?week=last            — the period BEFORE the current one
//   ?date=YYYY-MM-DD      — the period CONTAINING that date (admin date picker)
// Period length and target count come from admin settings (reading.target /
// reading.periodDays). Default is 2 readings per 7-day week.
export async function GET(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const weekSel = (searchParams.get('week') || 'this').toLowerCase();
  const dateParam = (searchParams.get('date') || '').trim();

  let submissions = [];
  let settings;
  let reg = { farms: [], pipes: [] };
  let master = { ok: false, pipes: [], villages: [] };
  try {
    [submissions, settings, reg, master] = await Promise.all([
      fetchSubmissions(), getSettings(), getDisabledRegistry(), fetchFormMaster().catch(() => ({ ok: false, pipes: [], villages: [] })),
    ]);
  } catch (e) {
    return NextResponse.json({ error: e.message, villages: [] }, { status: 200 });
  }

  const target = Math.max(1, Number(settings?.reading?.target) || 2);
  const periodDays = Math.max(1, Number(settings?.reading?.periodDays) || 7);
  const periodLabel = String(settings?.reading?.periodLabel || 'week');
  const formUploadUrl = settings?.project?.formUploadUrl || '';

  // Turned-off meters/farms must never appear as pending in the tracker.
  const lc = (x) => String(x || '').trim().toLowerCase();
  const offFarms = new Set((reg.farms || []).map(lc));
  const offMeters = new Set((reg.pipes || []).map(lc));

  let allowed = null;
  if (user.role === 'user') {
    allowed = new Set((user.villages || []).map((v) => String(v).trim().toLowerCase()));
  }

  const now = new Date();
  let ref = now;
  let mode = 'this';
  if (weekSel === 'last') {
    ref = new Date(now.getTime() - periodDays * 86400000);
    mode = 'last';
  }
  if (dateParam) {
    const t = Date.parse(dateParam);
    if (!Number.isNaN(t)) { ref = new Date(t); mode = 'custom'; }
  }

  let periodStart, periodEnd;
  if (periodDays === 7) {
    periodStart = startOfWeek(ref);
    periodEnd = endOfWeek(ref);
  } else {
    periodEnd = endOfWeek(ref);
    periodStart = new Date(periodEnd.getTime() - periodDays * 86400000);
  }
  const isCurrent = now.getTime() >= periodStart.getTime() && now.getTime() < periodEnd.getTime();

  const meters = {};
  for (const s of submissions) {
    if (s._dead) continue; // dead readings never count toward the tracker
    const serial = getField(s, 'serial');
    if (!serial) continue;
    // Skip meters (or whole farms) the admin has switched OFF.
    if (offMeters.has(lc(serial)) || offFarms.has(lc(getField(s, 'farm')))) continue;
    const village = getField(s, 'village') || 'Unknown';
    if (allowed && !allowed.has(String(village).trim().toLowerCase())) continue;

    const key = `${village}|||${serial}`;
    if (!meters[key]) {
      meters[key] = { serial, village, countThisPeriod: 0, lastReading: null, lastDate: null, lastSurveyor: null, lastTs: 0 };
    }
    const m = meters[key];

    const rt = readingDate(s).getTime();
    if (!Number.isNaN(rt) && rt >= periodStart.getTime() && rt < periodEnd.getTime()) {
      m.countThisPeriod += 1;
    }
    const upTs = new Date(s._submission_time).getTime();
    if (!Number.isNaN(upTs) && upTs > m.lastTs) {
      m.lastTs = upTs;
      const r = parseReading(getField(s, 'endReading'));
      m.lastReading = Number.isNaN(r) ? null : r;
      m.lastDate = s._submission_time;
      m.lastSurveyor = getField(s, 'surveyor') || null;
    }
  }

  // Meters that EXIST in the Kobo form definition but have never been read yet
  // must still show up as "pending" — otherwise they silently vanish from the
  // tracker and the total here under-counts vs the overview (which does count
  // the full meter universe). Add each such meter once, skipping disabled ones,
  // and (for a field assistant) only inside their assigned villages.
  if (master.ok && Array.isArray(master.pipes)) {
    // Normalise serials (drop whitespace/zero-width + lowercase) so a never-read
    // form meter isn't added again when a submission already covers it under a
    // slightly dirty serial — keeps this total consistent with the overview.
    const normS = (x) => String(x ?? '').replace(new RegExp('[\\s\\u200B\\u200C\\u200D\\uFEFF]', 'g'), '').toLowerCase();
    const seenSerials = new Set(Object.values(meters).map((m) => normS(m.serial)));
    for (const pm of master.pipes) {
      const serial = pm.serial;
      if (!serial || seenSerials.has(normS(serial))) continue;
      if (offMeters.has(lc(serial)) || offFarms.has(lc(pm.farm))) continue;
      const village = pm.village || 'Unknown';
      if (allowed && !allowed.has(String(village).trim().toLowerCase())) continue;
      seenSerials.add(normS(serial));
      meters[`${village}|||${serial}`] = { serial, village, countThisPeriod: 0, lastReading: null, lastDate: null, lastSurveyor: null, lastTs: 0 };
    }
  }

  const byVillage = {};
  for (const key in meters) {
    const m = meters[key];
    const status = m.countThisPeriod >= target ? 'done' : m.countThisPeriod > 0 ? 'partial' : 'pending';
    const row = { serial: m.serial, countThisPeriod: m.countThisPeriod, status, lastReading: m.lastReading, lastDate: m.lastDate, lastSurveyor: m.lastSurveyor };
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

  const daysLeft = isCurrent
    ? Math.max(0, Math.floor((periodEnd.getTime() - now.getTime()) / 86400000))
    : 0;

  return NextResponse.json({
    villages, totals,
    week: mode,
    target, periodDays, periodLabel,
    weekStart: periodStart.toISOString(),
    weekEnd: periodEnd.toISOString(),
    daysLeft,
    isCurrentWeek: isCurrent,
    role: user.role,
    formUploadUrl,
    surveyorName: user.role === 'user' ? user.name : '',
  });
}
