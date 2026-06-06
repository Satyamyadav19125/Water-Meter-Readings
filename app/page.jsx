import { fetchSubmissions } from '@/lib/kobo';
import { computeWeeklyStatus, deriveMeters, daysRemaining } from '@/lib/weekly';
import { getAssignments, isDbConfigured } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { filterSubmissionsForUser, filterAssignmentsForUser } from '@/lib/filter';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let submissions = [];
  let assignments = [];
  let error = null;
  let currentUser = null;

  try {
    [submissions, assignments, currentUser] = await Promise.all([
      fetchSubmissions(),
      isDbConfigured() ? getAssignments() : Promise.resolve([]),
      getCurrentUser(),
    ]);
  } catch (e) {
    error = e.message;
  }

  submissions = await filterSubmissionsForUser(submissions);
  assignments = await filterAssignmentsForUser(assignments);

  if (error) return <ErrorBox message={error} />;

  const meters = deriveMeters(assignments, submissions);
  const status = computeWeeklyStatus(meters, submissions);
  const remaining = daysRemaining();
  const done = status.filter((s) => s.status === 'done').length;
  const partial = status.filter((s) => s.status === 'partial').length;
  const pending = status.filter((s) => s.status === 'pending').length;

  const byVillage = {};
  for (const s of status) {
    const v = s.village || 'Unknown';
    if (!byVillage[v]) byVillage[v] = [];
    byVillage[v].push(s);
  }
  const villageNames = Object.keys(byVillage).sort();

  return (
    <div className="space-y-4">
      {currentUser?.role === 'user' && (
        <div className="bg-brand-50 border border-brand-200 rounded p-3 text-sm text-brand-900">
          Showing your villages only — <strong>{currentUser.name}</strong>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
        <Stat label="Days left in week" value={remaining} color="bg-slate-200" />
        <Stat label="Done (2/2)" value={done} color="bg-emerald-100" />
        <Stat label="Partial (1/2)" value={partial} color="bg-amber-100" />
        <Stat label="Pending (0/2)" value={pending} color="bg-rose-100" />
      </div>

      {!isDbConfigured() && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-900">
          <strong>Setup needed:</strong> Add MONGODB_URI in Vercel environment variables.
        </div>
      )}

      <div className="space-y-3">
        {villageNames.map((v) => (
          <VillageCard key={v} village={v} meters={byVillage[v]} />
        ))}
        {status.length === 0 && (
          <div className="bg-white rounded-lg shadow p-6 text-center text-slate-500">
            {currentUser?.role === 'user'
              ? 'No villages assigned to you yet. Ask the admin to add some.'
              : <>No data yet. Go to <a href="/assignments" className="text-brand-600 underline">Assignments</a> to assign villages.</>}
          </div>
        )}
      </div>
    </div>
  );
}

function VillageCard({ village, meters }) {
  const pending = meters.filter((m) => m.status !== 'done').length;
  const assignedTo = meters[0]?.assignedTo || 'Unassigned';
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold flex items-center gap-2">
            <span className="text-slate-400">🏘️</span>
            <span className="truncate">{village}</span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {meters.length} meters · assigned to {assignedTo}
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded font-medium shrink-0 ${pending === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
          {pending === 0 ? 'All done' : `${pending} pending`}
        </span>
      </div>
      <ul className="divide-y divide-slate-100">
        {meters.map((m) => (
          <li key={m.serial} className="px-4 py-2.5 flex items-center gap-3">
            <StatusPill status={m.status} />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-500 font-mono truncate">{m.serial}</div>
              {m.lastReadingDate && (
                <div className="text-[11px] text-slate-400">
                  Last reading: {new Date(m.lastReadingDate).toLocaleDateString()}
                  {m.daysSinceLast !== null && m.daysSinceLast > 0 && (
                    <> ({m.daysSinceLast}d ago)</>
                  )}
                </div>
              )}
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
      <p className="text-xs mt-2">
        Visit <a href="/debug" className="underline">/debug</a> to see what's failing (admin only).
      </p>
    </div>
  );
}
