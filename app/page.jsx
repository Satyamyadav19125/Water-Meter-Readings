// Home page = pending this week
import { fetchSubmissions } from '@/lib/kobo';
import { computeWeeklyStatus, deriveMeters, daysRemaining } from '@/lib/weekly';
import assignmentsData from '@/data/assignments.json';

// Refresh every 60 seconds (Next.js ISR)
export const revalidate = 60;

export default async function HomePage() {
  let submissions = [];
  let error = null;
  try {
    submissions = await fetchSubmissions();
  } catch (e) {
    error = e.message;
  }

  const meters = deriveMeters(assignmentsData.assignments, submissions);
  const status = computeWeeklyStatus(meters, submissions);
  const remaining = daysRemaining();

  const done = status.filter((s) => s.status === 'done').length;
  const partial = status.filter((s) => s.status === 'partial').length;
  const pending = status.filter((s) => s.status === 'pending').length;

  if (error) {
    return (
      <div className="rounded border border-red-300 bg-red-50 p-4 text-red-800">
        <p className="font-semibold mb-1">Could not load data from Kobo</p>
        <p className="text-sm">{error}</p>
        <p className="text-sm mt-2">
          Check your environment variables in Vercel: <code>KOBO_API_TOKEN</code>,{' '}
          <code>KOBO_BASE_URL</code>, and <code>KOBO_ASSET_UID</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Days left in week" value={remaining} color="bg-slate-100" />
        <Stat label="Done (2 readings)" value={done} color="bg-emerald-100" />
        <Stat label="Partial (1 reading)" value={partial} color="bg-amber-100" />
        <Stat label="Pending (0 readings)" value={pending} color="bg-rose-100" />
      </div>

      <h2 className="text-lg font-semibold mt-6">Meters this week</h2>
      <div className="overflow-x-auto bg-white rounded shadow">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="p-2">Status</th>
              <th className="p-2">Village</th>
              <th className="p-2">Meter serial</th>
              <th className="p-2">Assigned to</th>
              <th className="p-2">Readings this week</th>
            </tr>
          </thead>
          <tbody>
            {status.map((s) => (
              <tr key={`${s.village}-${s.serial}`} className="border-t">
                <td className="p-2"><StatusPill status={s.status} /></td>
                <td className="p-2">{s.village}</td>
                <td className="p-2 font-mono text-xs">{s.serial}</td>
                <td className="p-2">{s.assignedTo}</td>
                <td className="p-2">{s.submittedCount} / {s.required}</td>
              </tr>
            ))}
            {status.length === 0 && (
              <tr><td className="p-4 text-slate-500" colSpan={5}>No meters configured yet. Edit <code>data/assignments.json</code> in GitHub.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className={`rounded p-3 ${color}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-slate-700">{label}</div>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    done: 'bg-emerald-200 text-emerald-900',
    partial: 'bg-amber-200 text-amber-900',
    pending: 'bg-rose-200 text-rose-900',
  };
  const label = { done: 'Done', partial: 'Partial', pending: 'Pending' }[status];
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${map[status]}`}>{label}</span>;
}
