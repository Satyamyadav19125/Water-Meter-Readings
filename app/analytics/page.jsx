import { fetchSubmissions } from '@/lib/kobo';
import { filterSubmissionsForUser } from '@/lib/filter';
import { getField, parseReading } from '@/lib/fieldMap';
import { detectRedFlags } from '@/lib/redflags';
import { getSettings } from '@/lib/db';
import { BarChart, LineChart, DonutChart } from '@/components/SimpleCharts';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  let submissions = [];
  let error = null;
  let settings;
  try {
    [submissions, settings] = await Promise.all([fetchSubmissions(), getSettings()]);
  } catch (e) { error = e.message; }

  if (error) return <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800 text-sm">{error}</div>;

  submissions = await filterSubmissionsForUser(submissions);
  const flags = detectRedFlags(submissions, { enabled: settings?.redFlags });

  const total = submissions.length;
  const flaggedTotal = Object.keys(flags).length;
  const cleanTotal = total - flaggedTotal;

  const villageCounts = {};
  const surveyorCounts = {};
  const readingsByMeter = {};
  const byDate = {};

  for (const s of submissions) {
    const v = getField(s, 'village') || 'Unknown';
    const sv = getField(s, 'surveyor') || 'Unknown';
    const serial = getField(s, 'serial');
    const reading = parseReading(getField(s, 'endReading'));
    villageCounts[v] = (villageCounts[v] || 0) + 1;
    surveyorCounts[sv] = (surveyorCounts[sv] || 0) + 1;
    if (serial && !Number.isNaN(reading)) {
      if (!readingsByMeter[serial]) readingsByMeter[serial] = [];
      readingsByMeter[serial].push({ time: new Date(s._submission_time).getTime(), reading, village: getField(s, 'village') });
    }
    const d = new Date(s._submission_time).toISOString().slice(0, 10);
    byDate[d] = (byDate[d] || 0) + 1;
  }

  const uniqueVillages = Object.keys(villageCounts).length;
  const uniqueSurveyors = Object.keys(surveyorCounts).length;
  const uniqueMeters = Object.keys(readingsByMeter).length;

  let avgLatest = 0;
  let meterCountForAvg = 0;
  let topUsageMeters = [];
  for (const [serial, list] of Object.entries(readingsByMeter)) {
    list.sort((a, b) => a.time - b.time);
    const latest = list[list.length - 1].reading;
    const earliest = list[0].reading;
    if (!Number.isNaN(latest)) { avgLatest += latest; meterCountForAvg++; }
    const used = list.length > 1 && !Number.isNaN(earliest) && !Number.isNaN(latest) ? Math.max(0, latest - earliest) : 0;
    topUsageMeters.push({ serial, used, village: list[0].village || 'Unknown' });
  }
  avgLatest = meterCountForAvg > 0 ? Math.round(avgLatest / meterCountForAvg) : 0;
  topUsageMeters.sort((a, b) => b.used - a.used);
  topUsageMeters = topUsageMeters.slice(0, 10);

  const villageBars = Object.entries(villageCounts).map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value).slice(0, 12);
  const surveyorBars = Object.entries(surveyorCounts).map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  const sortedDates = Object.keys(byDate).sort();
  let timeline = sortedDates.map((d) => ({
    label: new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    value: byDate[d],
  }));
  if (timeline.length > 30) timeline = timeline.slice(-30);

  const cleanVsFlagged = [
    { label: 'Clean', value: cleanTotal, color: '#22c55e' },
    { label: 'Flagged', value: flaggedTotal, color: '#ef4444' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">📊 Analytics</h2>
        <p className="text-sm text-slate-500">All data across the active form</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
        <Kpi label="Total" value={total.toLocaleString()} color="bg-brand-50 text-brand-900"/>
        <Kpi label="Clean" value={cleanTotal.toLocaleString()} color="bg-field-50 text-field-900"/>
        <Kpi label="🚩 Flagged" value={flaggedTotal.toLocaleString()} color={flaggedTotal > 0 ? 'bg-red-50 text-red-900' : 'bg-slate-50 text-slate-700'}/>
        <Kpi label="Quality rate" value={total > 0 ? `${Math.round((cleanTotal / total) * 100)}%` : '—'} color="bg-emerald-50 text-emerald-900"/>
        <Kpi label="Villages" value={uniqueVillages} color="bg-amber-50 text-amber-900"/>
        <Kpi label="Surveyors" value={uniqueSurveyors} color="bg-violet-50 text-violet-900"/>
        <Kpi label="Unique meters" value={uniqueMeters} color="bg-sky-50 text-sky-900"/>
        <Kpi label="Avg latest reading" value={avgLatest.toLocaleString()} color="bg-slate-100 text-slate-900"/>
      </div>

      <Card title="Submissions over time" subtitle={`${timeline.length} days with activity · ${total} total readings`}>
        <LineChart data={timeline} color="#0284c7" emptyText="No submissions yet"/>
      </Card>

      <Card title="Submissions per village" subtitle={`${uniqueVillages} villages · top 12 shown`}>
        <BarChart data={villageBars} color="#0284c7" emptyText="No villages yet"/>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card title="Submissions per surveyor" subtitle={`${uniqueSurveyors} surveyors total`}>
          <VerticalBars data={surveyorBars} color="#7c3aed"/>
        </Card>
        <Card title="Data quality" subtitle={`${cleanTotal} clean · ${flaggedTotal} flagged`}>
          <DonutChart data={cleanVsFlagged} emptyText="No submissions yet"/>
        </Card>
      </div>

      <Card title="Top 10 meters by total usage" subtitle="Difference between first and latest reading">
        {topUsageMeters.length === 0 ? (
          <div className="text-sm text-slate-400 py-8 text-center">Not enough readings yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left py-2 pr-3">#</th>
                  <th className="text-left py-2 pr-3">Meter</th>
                  <th className="text-left py-2 pr-3">Village</th>
                  <th className="text-right py-2 pl-3">Total used</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topUsageMeters.map((m, i) => (
                  <tr key={m.serial} className="hover:bg-slate-50">
                    <td className="py-2 pr-3 text-slate-400">{i + 1}</td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      <a href={`/meter/${encodeURIComponent(m.serial)}`} className="text-brand-600 hover:underline">{m.serial}</a>
                    </td>
                    <td className="py-2 pr-3">{m.village}</td>
                    <td className="py-2 pl-3 text-right font-semibold tabular-nums">{m.used.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Kpi({ label, value, color }) {
  return (
    <div className={`rounded-xl p-3 ${color}`}>
      <div className="text-2xl font-bold leading-tight tabular-nums">{value}</div>
      <div className="text-[11px] sm:text-xs mt-0.5 opacity-80">{label}</div>
    </div>
  );
}

function Card({ title, subtitle, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="mb-3">
        <h3 className="font-semibold text-base">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function VerticalBars({ data, color = '#0284c7' }) {
  if (!data || data.length === 0) return <div className="text-sm text-slate-400 text-center py-8">No data</div>;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <ul className="space-y-2.5">
      {data.map((d, i) => (
        <li key={i}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium text-slate-700 truncate pr-2">{d.label}</span>
            <span className="text-slate-500 tabular-nums shrink-0">{d.value}</span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${(d.value / max) * 100}%`, background: color }}/>
          </div>
        </li>
      ))}
    </ul>
  );
}
