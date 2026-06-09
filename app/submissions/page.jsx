import { Suspense } from 'react';
import { fetchSubmissions } from '@/lib/kobo';
import { detectRedFlags } from '@/lib/redflags';
import { getSettings } from '@/lib/db';
import { filterSubmissionsForUser, applyUrlFilters, applyWhoFilter } from '@/lib/filter';
import { getCurrentUser } from '@/lib/auth';
import { getField } from '@/lib/fieldMap';
import SubmissionList from '@/components/SubmissionList';
import FilterBar from '@/components/FilterBar';
import ExportButton from '@/components/ExportButton';

export const dynamic = 'force-dynamic';

export default async function SubmissionsPage({ searchParams }) {
  const sp = (await searchParams) || {};
  let allSubmissions = [];
  let settings;
  let error = null;
  try {
    [allSubmissions, settings] = await Promise.all([fetchSubmissions(), getSettings()]);
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

  const currentUser = await getCurrentUser();
  const isUser = currentUser?.role === 'user';
  const myName = currentUser?.name || '';

  const villageScoped = await filterSubmissionsForUser(allSubmissions);

  const allFlags = detectRedFlags(villageScoped, { enabled: settings?.redFlags });

  let mineFlagged = 0, othersFlagged = 0;
  if (isUser) {
    for (const s of villageScoped) {
      if (!allFlags[s._id]) continue;
      if (String(getField(s, 'surveyor') || '').trim().toLowerCase() === myName.trim().toLowerCase()) mineFlagged++;
      else othersFlagged++;
    }
  }

  const who = isUser ? (sp.who || 'all') : 'all';
  let scoped = applyWhoFilter(villageScoped, who, myName);
  scoped = applyUrlFilters(scoped, sp);

  const flagFilter = sp.flag || 'all';
  const filtered = scoped.filter((s) => {
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
          </p>
          {isUser && (
            <p className="text-xs text-slate-500 mt-0.5">
              🚩 <span className="text-red-600 font-medium">{mineFlagged}</span> flagged by you ·{' '}
              <span className="text-amber-600 font-medium">{othersFlagged}</span> flagged by others in your villages
            </p>
          )}
        </div>
        <Suspense fallback={<div className="h-9 w-24 bg-slate-200 rounded animate-pulse" />}>
          <ExportButton />
        </Suspense>
      </div>

      {isUser && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <WhoChip name="all" current={who} sp={sp}>Everyone in my villages</WhoChip>
          <WhoChip name="mine" current={who} sp={sp}>Only mine</WhoChip>
          <WhoChip name="others" current={who} sp={sp}>Others in my villages</WhoChip>
        </div>
      )}

      <Suspense fallback={<div className="h-12 bg-slate-100 rounded-lg animate-pulse" />}>
        <FilterBar />
      </Suspense>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <FlagChip name="all" current={flagFilter} sp={sp}>All</FlagChip>
        <FlagChip name="clean" current={flagFilter} sp={sp}>✓ Clean</FlagChip>
        <FlagChip name="flagged" current={flagFilter} sp={sp} danger>🚩 Flagged ({Object.keys(allFlags).length})</FlagChip>
      </div>

      <SubmissionList submissions={sorted} flags={allFlags} allSubmissions={villageScoped} />
    </div>
  );
}

function chipHref(base, sp, key, name) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp || {})) {
    if (k !== key && v) params.set(k, Array.isArray(v) ? v[0] : String(v));
  }
  if (name !== 'all') params.set(key, name);
  return `${base}${params.toString() ? '?' + params.toString() : ''}`;
}

function FlagChip({ name, current, sp, danger, children }) {
  const active = (current || 'all') === name;
  return (
    <a href={chipHref('/submissions', sp, 'flag', name)} className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition ${
      active ? (danger ? 'bg-red-600 text-white border-red-600' : 'bg-brand-600 text-white border-brand-600') : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
    }`}>{children}</a>
  );
}

function WhoChip({ name, current, sp, children }) {
  const active = (current || 'all') === name;
  return (
    <a href={chipHref('/submissions', sp, 'who', name)} className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition ${
      active ? 'bg-field-600 text-white border-field-600' : 'bg-white text-slate-700 border-slate-300 hover:border-field-500'
    }`}>{children}</a>
  );
}
