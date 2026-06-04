import { fetchSubmissions } from '@/lib/kobo';
import { detectRedFlags } from '@/lib/redflags';
import { filterSubmissionsForUser } from '@/lib/filter';
import { getCurrentUser } from '@/lib/auth';
import SubmissionList from '@/components/SubmissionList';

export const revalidate = 60;

export default async function SubmissionsPage({ searchParams }) {
  let submissions = [];
  let error = null;
  try {
    submissions = await fetchSubmissions();
  } catch (e) {
    error = e.message;
  }
  if (error) return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
      <p className="font-semibold mb-1">Error</p>
      <p className="text-sm">{error}</p>
    </div>
  );

  submissions = await filterSubmissionsForUser(submissions);
  const currentUser = await getCurrentUser();

  const flags = detectRedFlags(submissions);
  const flagCount = Object.keys(flags).length;
  const filter = searchParams?.filter || 'all';

  const sorted = [...submissions].sort(
    (a, b) => new Date(b._submission_time).getTime() - new Date(a._submission_time).getTime()
  );

  const filtered = sorted.filter((s) => {
    if (filter === 'flagged') return !!flags[s._id];
    if (filter === 'clean') return !flags[s._id];
    return true;
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Submissions</h2>
        <p className="text-sm text-slate-500">
          {submissions.length} total · {flagCount} flagged
          {currentUser?.role === 'user' && <> · yours only</>}
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
        <FilterChip href="/submissions?filter=all" active={filter === 'all'}>All ({submissions.length})</FilterChip>
        <FilterChip href="/submissions?filter=clean" active={filter === 'clean'}>✓ Clean ({submissions.length - flagCount})</FilterChip>
        <FilterChip href="/submissions?filter=flagged" active={filter === 'flagged'} danger>🚩 Flagged ({flagCount})</FilterChip>
      </div>

      <SubmissionList submissions={filtered} flags={flags} />
    </div>
  );
}

function FilterChip({ href, active, danger, children }) {
  return (
    <a href={href} className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition ${
      active ? (danger ? 'bg-red-600 text-white border-red-600' : 'bg-brand-600 text-white border-brand-600') : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
    }`}>{children}</a>
  );
}
