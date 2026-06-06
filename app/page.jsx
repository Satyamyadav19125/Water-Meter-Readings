import { fetchSubmissions } from '@/lib/kobo';
import { computeWeeklyStatus, deriveMeters, daysRemaining } from '@/lib/weekly';
import { getAssignments, isDbConfigured } from '@/lib/db';

export const revalidate = 60;

export default async function HomePage() {
  let submissions = [];
  let assignments = [];
  let error = null;

  try {
    [submissions, assignments] = await Promise.all([
      fetchSubmissions(),
      isDbConfigured() ? getAssignments() : Promise.resolve([]),
    ]);
  } catch (e) {
    error = e.message;
  }

  if (error) return <ErrorBox message={error} />;

  const meters = deriveMeters(assignments, submissions);
  const status = computeWeeklyStatus(meters, submissions);
  const remaining = daysRemaining();
  const done = status.filter((s) => s.status === 'done').length;
  const partial = status.filter((s) => s.status === 'partial').length;
  const pending = status.filter((s) => s.status === 'pending').length;

  const byPerson = {};
  for (const s of status) {
    const p = s.assignedTo || 'Unassigned';
    if (!byPerson[p]) byPerson[p] = [];
    byPerson[p].push(s);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
        <Stat label="Days left" value={remaining} color="bg-slate-200" />
        <Stat label="Done" value={done} color="bg-emerald-100" />
        <Stat label="Partial" value={partial} color="bg-amber-100" />
        <Stat label="Pending" value={pending} color="bg-rose-100" />
      </div>

      {!isDbConfigured() && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-900">
          <strong>Setup needed:</strong> Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel environment variables.
        </div>
      )}

      <div className="space-y-3">
        {Object.entries(byPerson).map(([person, list]) => (
          <PersonCard key={person} person={person} meters={list} />
        ))}
        {status.length === 0 && (
          <div className="bg-white rounded-lg shadow p-6 text-center text-slate-500">
            No meters configured yet. Go to <a href="/assignments" className="text-brand-600 underline">Assignments</a> to add some.
          </div>
        )}
      </div>
    </div>
  );
}

function PersonCard({ person, meters }) {
  const pending = meters.filter((m) => m.status !== 'done').length;
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b flex items-center justify-between">
        <div className="font-semibold flex items-center gap-2">
          <span className="text-slate-400">👤</span>
          {person}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${pending === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
          {pending === 0 ? 'All done' : `${pending} pending`}
        </span>
      </div>
      <ul className="divide-y divide-slate-100">
        {meters.map((m) => (
          <li key={`${m.village}-${m.serial}`} className="px-4 py-2.5 flex items-center gap-3">
            <StatusPill status={m.status} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{m.village}</div>
              <div className="text-xs text-slate-500 font-mono truncate">{m.serial}</div>
            </div>
            <div className="text-sm font-semibold tabular-nums text-slate-700">
              {m.submittedCount}/{m.required}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className={`rounded-lg p-3 ${color}`}>
      <div className="text-2xl sm:text-3xl font-bold leading-tight">{value}</div>
      <div className="text-xs text-slate-700 mt-0.5">{label}</div>
    </div>
  );
}

function StatusPill({ status }) {
  const styles = {
    done: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
    partial: 'bg-amber-100 text-amber-800 ring-amber-200',
    pending: 'bg-rose-100 text-rose-800 ring-rose-200',
  };
  const labels = { done: '✓', partial: '½', pending: '○' };
  return (
    <span className={`w-7 h-7 inline-flex items-center justify-center text-xs font-bold rounded-full ring-1 ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function ErrorBox({ message }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
      <p className="font-semibold mb-1">Could not load data from Kobo</p>
      <p className="text-sm">{message}</p>
    </div>
  );
}
