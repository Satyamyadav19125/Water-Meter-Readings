import { fetchSubmissions } from '@/lib/kobo';
import { detectRedFlags } from '@/lib/redflags';
import { filterSubmissionsForUser, applyUrlFilters } from '@/lib/filter';
import { getCurrentUser } from '@/lib/auth';
import SubmissionList from '@/components/SubmissionList';
import FilterBar from '@/components/FilterBar';
import ExportButton from '@/components/ExportButton';

export const revalidate = 60;

export default async function SubmissionsPage({ searchParams }) {
  let allSubmissions = [];
  let error = null;
  try {
    allSubmissions = await fetchSubmissions();
  } catch (e) {
    error = e.message;
  }
  if (error) return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
      <p className="font-semibold mb-1">Error</p>
      <p className="text-sm">{error}</p>
      <p className="text-xs mt-2">Run <a href="/debug" className="underline">/debug</a> for diagnostics.</p>
    </div>
  );

  allSubmissions = await filterSubmissionsForUser(allSubmissions);
  const currentUser = await getCurrentUser();

  const filtered0 = applyUrlFilters(allSubmissions, searchParams);
  const allFlags = detectRedFlags(allSubmissions);

  const flagFilter = searchParams?.flag || 'all';
  const filtered = filtered0.filter((s) => {
    if (flagFilter === 'flagged') return !!allFlags[s._id];
    if (flagFilter === 'clean') return !allFlags[s._id];
    return true;
  });

  const sorted = [...filtered].sort(
    (a, b) => new Date(b._submission_time).getTime() - new Date(a._submission_time).getTime()
  );

  const filteredFlagCount = sorted.filter((s) => allFlags[s._id]).length;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">Submissions</h2>
          <p className="text-sm text-slate-500">
            {sorted.length} shown · {filteredFlagCount} flagged
            {currentUser?.role === 'user' && <> · yours only</>}
          </p>
        </div>
        <ExportButton />
      </div>

      <FilterBar />

      <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
        <FlagChip name="all" current={flagFilter} sp={searchParams}>All</FlagChip>
        <FlagChip name="clean" current={flagFilter} sp={searchParams}>✓ Clean</FlagChip>
        <FlagChip name="flagged" current={flagFilter} sp={searchParams} danger>🚩 Flagged ({Object.keys(allFlags).length})</FlagChip>
      </div>

      <SubmissionList submissions={sorted} flags={allFlags} allSubmissions={allSubmissions} />
    </div>
  );
}

function FlagChip({ name, current, sp, danger, children }) {
  const active = (current || 'all') === name;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp || {})) {
    if (k !== 'flag' && v) params.set(k, String(v));
  }
  if (name !== 'all') params.set('flag', name);
  const href = `/submissions${params.toString() ? '?' + params.toString() : ''}`;
  return (
    <a href={href} className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition ${
      active ? (danger ? 'bg-red-600 text-white border-red-600' : 'bg-brand-600 text-white border-brand-600') : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
    }`}>{children}</a>
  );
}
