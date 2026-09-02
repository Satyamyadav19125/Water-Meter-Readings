import { NextResponse } from 'next/server';
import { fetchSubmissions } from '@/lib/kobo';
import { getCurrentUser } from '@/lib/auth';
import { excludeDisabled } from '@/lib/filter';
import { getSettings } from '@/lib/db';
import { getField } from '@/lib/fieldMap';
import { startOfWeek, endOfWeek } from '@/lib/weekly';

export const dynamic = 'force-dynamic';

// Per field-assistant progress: how many readings each surveyor has actually
// taken. Feeds the "work done per person" strip on the Team/Assignments page so
// an admin can see, at a glance, who is producing data and who has gone quiet.
//
// Counts exclude dead readings and readings on switched-off meters/farms (same
// as the rest of the tool). A `user` (field assistant) only ever sees their own
// numbers; an admin sees everyone.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

  try {
    let subs = await fetchSubmissions();
    subs = await excludeDisabled(subs); // drops dead + disabled meters/farms
    const settings = await getSettings();
    const periodDays = Math.max(1, Number(settings?.reading?.periodDays) || 7);
    const periodLabel = String(settings?.reading?.periodLabel || 'week');

    const now = new Date();
    let periodStart, periodEnd;
    if (periodDays === 7) {
      periodStart = startOfWeek(now);
      periodEnd = endOfWeek(now);
    } else {
      periodEnd = endOfWeek(now);
      periodStart = new Date(periodEnd.getTime() - periodDays * 86400000);
    }

    const lc = (x) => String(x || '').trim().toLowerCase();
    const onlyMe = user.role === 'user' ? lc(user.name) : null;

    const stats = {}; // name -> { total, thisPeriod, meters:Set, villages:Set, lastTs }
    for (const s of subs) {
      const name = getField(s, 'surveyor');
      if (!name) continue;
      if (onlyMe && lc(name) !== onlyMe) continue;
      if (!stats[name]) stats[name] = { total: 0, thisPeriod: 0, meters: new Set(), villages: new Set(), lastTs: 0 };
      const st = stats[name];
      st.total += 1;
      const serial = getField(s, 'serial');
      if (serial) st.meters.add(lc(serial));
      const village = getField(s, 'village');
      if (village) st.villages.add(lc(village));
      // "this period" counts readings this person actually SUBMITTED in the
      // window (upload time) — matching "last active". Counting by the form's
      // date field would drop readings a surveyor uploaded now but dated to an
      // earlier day (surveyors frequently back-date), which read as "0 this week"
      // even though the work was done this week.
      const up = new Date(s._submission_time).getTime();
      if (!Number.isNaN(up)) {
        if (up > st.lastTs) st.lastTs = up;
        if (up >= periodStart.getTime() && up < periodEnd.getTime()) st.thisPeriod += 1;
      }
    }

    const surveyors = Object.entries(stats)
      .map(([name, st]) => ({
        name,
        total: st.total,
        thisPeriod: st.thisPeriod,
        meters: st.meters.size,
        villages: st.villages.size,
        lastActive: st.lastTs ? new Date(st.lastTs).toISOString() : null,
      }))
      .sort((a, b) => b.total - a.total);

    return NextResponse.json({ surveyors, periodDays, periodLabel, weekStart: periodStart.toISOString(), weekEnd: periodEnd.toISOString() });
  } catch (e) {
    return NextResponse.json({ error: e.message, surveyors: [] }, { status: 200 });
  }
}
