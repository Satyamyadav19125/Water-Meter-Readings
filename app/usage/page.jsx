import { Suspense } from 'react';
import Link from 'next/link';
import { fetchSubmissions } from '@/lib/kobo';
import { computeConsumption } from '@/lib/weekly';
import { filterSubmissionsForUser, applyUrlFilters, applyWhoFilter } from '@/lib/filter';
import { detectRedFlags } from '@/lib/redflags';
import { getSettings } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getField } from '@/lib/fieldMap';
import FilterBar from '@/components/FilterBar';
import ExportButton from '@/components/ExportButton';
import UsageRow from '@/components/UsageRow';

export const dynamic = 'force-dynamic';

export default async function UsagePage({ searchParams }) {
  const sp = (await searchParams) || {};
  let submissions = [];
  let settings;
  let error = null;
  try { [submissions, settings] = await Promise.all([fetchSubmissions(), getSettings()]); }
  catch (e) { error = e.message; }

  if (error) return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
      <p className="font-semibold mb-1">Error</p>
      <p className="text-sm">{error}</p>
    </div>
  );

  const currentUser = await getCurrentUser();
  const isUser = currentUser?.role === 'user';
  const myName = currentUser?.name || '';

  const villageScoped = await filterSubmissionsForUser(submissions);
  const flags = detectRedFlags(villageScoped, { enabled: settings?.redFlags });

  let mineFlagged = 0, othersFlagged = 0;
  if (isUser) {
    for (const s of villageScoped) {
      if (!flags[s._id]) continue;
      if (String(getField(s, 'surveyor') || '').trim().toLowerCase() === myName.trim().toLowerCase()) mineFlagged++;
      else othersFlagged++;
    }
  }

  const who = isUser ? (sp.who || 'all') : 'all';
  let scoped = applyWhoFilter(villageScoped, who, myName);
  scoped = applyUrlFilters(scoped, sp);

  const byId = {};
  for (const s of villageScoped) byId[s._id] = s;

  const consumption = computeConsumption(scoped);
  const totalUsage = consumption.reduce((sum, m) => sum + m.consumption.filter((c) => c.used > 0).reduce((s, c) => s + c.used, 0), 0);
  const flaggedCount = consumption.reduce((sum, m) => sum + m.consumption.filter((c) => c.flagged || flags[c.toSubmissionId]).length, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">Water Usage</h2>
          <p className="text-sm text-slate-500">Consumption between readings · tap any row to see both submissions</p>
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

      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <Stat label="Total units used" value={totalUsage.toLocaleString()} color="bg-brand-50" />
        <Stat label="Flagged readings" value={flaggedCount} color={flaggedCount > 0 ? 'bg-red-50' : 'bg-emerald-50'} />
      </div>

      <div className="space-y-3">
        {consumption.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center text-slate-500">No meters with multiple readings match the filters.</div>
        ) : (
          consumption.map((m) => {
            const usedTotal = m.consumption.filter((c) => c.used > 0).reduce((s, c) => s + c.used, 0);
            const hasFlag = m.consumption.some((c) => c.flagged || flags[c.toSubmissionId]);
            return (
              <div key={m.serial} className={`bg-white rounded-lg shadow overflow-hidden ${hasFlag ? 'ring-1 ring-red-200' : ''}`}>
                <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{m.village || 'Unknown village'}</div>
                    <div className="text-xs font-mono text-slate-500 truncate">{m.serial}</div>
                    {m.latestSurveyor && (
                      <div className="text-xs text-slate-500 mt-0.5">Latest by {m.latestSurveyor}</div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold tabular-nums">{usedTotal.toLocaleString()}</div>
                    <div className="text-xs text-slate-500">units used</div>
                    <Link href={`/meter/${encodeURIComponent(m.serial)}`} className="text-xs text-brand-600 hover:underline mt-1 inline-block">
                      Full history →
                    </Link>
                  </div>
                </div>
                <ul className="divide-y divide-slate-100">
                  {m.consumption.slice(-5).reverse().map((c) => (
                    <UsageRow
                      key={`${c.fromSubmissionId}-${c.toSubmissionId}`}
                      entry={c}
                      previous={byId[c.fromSubmissionId]}
                      current={byId[c.toSubmissionId]}
                      flag={flags[c.toSubmissionId]}
                    />
                  ))}
                  {m.consumption.length > 5 && (
                    <li className="px-4 py-2 text-xs text-slate-500 bg-slate-50 text-center">
                      Showing last 5 of {m.consumption.length} ·{' '}
                      <Link href={`/meter/${encodeURIComponent(m.serial)}`} className="text-brand-600 hover:underline">View all</Link>
                    </li>
                  )}
                </ul>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className={`rounded-lg p-3 ${color}`}>
      <div className="text-xl sm:text-2xl font-bold leading-tight">{value}</div>
      <div className="text-xs text-slate-700 mt-0.5">{label}</div>
    </div>
  );
}

function WhoChip({ name, current, sp, children }) {
  const active = (current || 'all') === name;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp || {})) {
    if (k !== 'who' && v) params.set(k, Array.isArray(v) ? v[0] : String(v));
  }
  if (name !== 'all') params.set('who', name);
  const href = `/usage${params.toString() ? '?' + params.toString() : ''}`;
  return (
    <a href={href} className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition ${
      active ? 'bg-field-600 text-white border-field-600' : 'bg-white text-slate-700 border-slate-300 hover:border-field-500'
    }`}>{children}</a>
  );
}
