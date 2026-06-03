import { fetchSubmissions } from '@/lib/kobo';
import { computeConsumption } from '@/lib/weekly';

export const revalidate = 60;

export default async function UsagePage() {
  let submissions = [];
  let error = null;
  try { submissions = await fetchSubmissions(); }
  catch (e) { error = e.message; }

  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"><p className="font-semibold mb-1">Error</p><p className="text-sm">{error}</p></div>;

  const consumption = computeConsumption(submissions);
  const totalUsage = consumption.reduce((sum, m) => sum + m.consumption.filter((c) => c.used > 0).reduce((s, c) => s + c.used, 0), 0);
  const flaggedCount = consumption.reduce((sum, m) => sum + m.consumption.filter((c) => c.flagged).length, 0);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Water Usage</h2>
        <p className="text-sm text-slate-500">Consumption between consecutive readings</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <div className="rounded-lg p-3 bg-brand-50"><div className="text-xl sm:text-2xl font-bold">{totalUsage.toLocaleString()}</div><div className="text-xs text-slate-700 mt-0.5">Total units used</div></div>
        <div className={`rounded-lg p-3 ${flaggedCount > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}><div className="text-xl sm:text-2xl font-bold">{flaggedCount}</div><div className="text-xs text-slate-700 mt-0.5">Flagged readings</div></div>
      </div>
      <div className="space-y-3">
        {consumption.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center text-slate-500">No meters with multiple readings yet.</div>
        ) : (
          consumption.map((m) => (
            <div key={m.serial} className={`bg-white rounded-lg shadow overflow-hidden ${m.consumption.some((c) => c.flagged) ? 'ring-1 ring-red-200' : ''}`}>
              <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between">
                <div><div className="font-semibold">{m.village || 'Unknown village'}</div><div className="text-xs font-mono text-slate-500">{m.serial}</div></div>
                <div className="text-right"><div className="text-lg font-bold tabular-nums">{m.consumption.filter((c) => c.used > 0).reduce((s, c) => s + c.used, 0).toLocaleString()}</div><div className="text-xs text-slate-500">units used</div></div>
              </div>
              <ul className="divide-y divide-slate-100">
                {m.consumption.map((c, i) => (
                  <li key={i} className={`px-4 py-2.5 flex items-center justify-between text-sm ${c.flagged ? 'bg-red-50' : ''}`}>
                    <div><div className="font-medium tabular-nums">{c.fromReading} → {c.toReading}</div><div className="text-xs text-slate-500">{new Date(c.fromDate).toLocaleDateString()} → {new Date(c.toDate).toLocaleDateString()}</div></div>
                    <div className={`text-right font-semibold tabular-nums ${c.flagged ? 'text-red-700' : 'text-slate-900'}`}>{c.flagged && '🚩 '}{c.used > 0 ? '+' : ''}{c.used}</div>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
