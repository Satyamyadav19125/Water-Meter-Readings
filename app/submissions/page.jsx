import { Suspense } from 'react';
import { fetchSubmissions } from '@/lib/kobo';
import { detectFlagsScoped } from '@/lib/flagContext';
import { sameDayDuplicates } from '@/lib/redflags';
import { getSettings, getVerifiedIds } from '@/lib/db';
import { filterSubmissionsForUser, applyUrlFilters } from '@/lib/filter';
import { getCurrentUser } from '@/lib/auth';
import SubmissionList from '@/components/SubmissionList';
import FilterBar from '@/components/FilterBar';
import ExportButton from '@/components/ExportButton';

export const dynamic = 'force-dynamic';

export default async function SubmissionsPage({ searchParams }) {
  const sp = (await searchParams) || {};
  let allSubmissions = [];
  let rawSubmissions = [];
  let settings;
  let verifiedIds = new Set();
  let error = null;
  try {
    // Two views of the SAME rows: `allSubmissions` has admin corrections applied,
    // `rawSubmissions` is the exact Kobo data. Both share the same cached Kobo
    // network fetch, so this is not a second round-trip — just the overlay differs.
    [allSubmissions, rawSubmissions, settings, verifiedIds] = await Promise.all([
      fetchSubmissions(),
      fetchSubmissions({ applyCorrections: false }),
      getSettings(),
      getVerifiedIds(),
    ]);
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
  const isAdmin = currentUser?.role === 'admin';
  const isGuest = currentUser?.role === 'guest';
  // A guest sees the admin-style tabs (read-only) but can't edit or download.
  const canViewAdmin = isAdmin || isGuest;
  const canEdit = isAdmin;
  const canDownload = isAdmin; // guests never download
  const guestCap = isGuest ? Math.max(1, Number(currentUser?.maxReadings) || 10) : 0;
  // Item 7: a surveyor sees their own flags only if the admin enabled it.
  const canSeeFlags = isAdmin || (isGuest && currentUser?.show?.redFlags !== false) || currentUser?.showFlags === true;

  const scopedAll = await filterSubmissionsForUser(allSubmissions);   // corrections overlaid
  const scopedRaw = await filterSubmissionsForUser(rawSubmissions);   // exact Kobo data
  // Look up each row's ORIGINAL (un-corrected) version so the Raw tab shows the
  // exact Kobo values. Same rows/_ids as `scopedAll`, so the counts match.
  const rawById = new Map(scopedRaw.map((s) => [String(s._id), s]));
  const toRaw = (s) => rawById.get(String(s._id)) || s;

  // Red-flag detection is admin-only. Surveyors don't see flag chips, red
  // colouring, or "this submission was flagged" warnings — quality review
  // is the admin's job, not theirs.
  const allFlags = canSeeFlags ? await detectFlagsScoped(scopedAll, settings) : {};
  const isRed = (id) => canSeeFlags && !!allFlags[id] && !verifiedIds.has(String(id));

  const filtered0 = applyUrlFilters(scopedAll, sp);
  const flagFilter = (canSeeFlags || canViewAdmin) ? (sp.flag || 'all') : 'all';

  // What each tab means (kept deliberately simple):
  //  • All        — every submission (the grand total, incl. dead & corrected)
  //  • Raw        — the SAME full set, shown EXACTLY as Kobo has them (no edits).
  //                 So Raw and All have the same count; Raw is always the biggest
  //                 tab and is >= Clean.
  //  • Red flags  — readings the checks flagged
  //  • Duplicate  — the same pipe read 2+ times on one date (incl. resolved)
  //  • Dead       — readings an admin marked as a mistake
  //  • Corrected  — readings an admin edited/corrected
  //  • Clean      — live, not-flagged readings (your fixes land here)
  const isDead = (s) => s._correction && s._correction.field === 'dead';
  const isCorrected = (s) => s._correction && s._correction.field !== 'dead';
  const dup = sameDayDuplicates(scopedAll);
  const isDuplicate = (s) => dup.ids.has(String(s._id));

  // All AND Raw = the full dataset (every submission). Clean/Corrected/Dead/etc.
  // are subsets, so Raw is always >= Clean.
  const totalCount = filtered0.length;
  const rawCount = totalCount;
  const correctedCount = canViewAdmin ? filtered0.filter(isCorrected).length : 0;
  const deadCount = canViewAdmin ? filtered0.filter(isDead).length : 0;
  const duplicateCount = canViewAdmin ? filtered0.filter(isDuplicate).length : 0;
  const redCount = canSeeFlags ? filtered0.filter((s) => isRed(s._id)).length : 0;
  const cleanCount = canSeeFlags ? filtered0.filter((s) => !isDead(s) && !isRed(s._id)).length : 0;

  let filtered;
  if (flagFilter === 'raw') {
    // Every submission, shown with its ORIGINAL Kobo values (dead/duplicate/
    // corrected forms all appear here as their untouched originals).
    filtered = filtered0.map(toRaw);
  } else {
    filtered = filtered0.filter((s) => {
      if (flagFilter === 'all') return true;             // everything, incl. dead
      if (flagFilter === 'dead') return isDead(s);
      // Duplicates INCLUDE resolved (dead) partners so you can see which you
      // deleted vs kept — checked before the dead rows are hidden below.
      if (flagFilter === 'duplicates') return isDuplicate(s);
      if (isDead(s)) return false;
      if (flagFilter === 'corrected' || flagFilter === 'fixed') return isCorrected(s);
      if (!canSeeFlags) return true;
      if (flagFilter === 'flagged') return isRed(s._id);
      if (flagFilter === 'clean') return !isRed(s._id);
      return true;
    });
  }

  // Newest first by SUBMISSION time, so a form uploaded today shows at the top
  // even if its form date is older.
  const sorted = [...filtered].sort((a, b) => new Date(b._submission_time).getTime() - new Date(a._submission_time).getTime());
  // Guests only ever see a small sample so no bulk data leaves the tool.
  const shown = guestCap ? sorted.slice(0, guestCap) : sorted;
  const filteredFlagCount = canSeeFlags ? shown.filter((s) => isRed(s._id)).length : 0;

  // The ALL tab is grouped into scrollable sections, each row in exactly one
  // group (priority: dead > flagged > duplicate > corrected > clean) so the
  // sections add up to the full total.
  let sections = null;
  if (flagFilter === 'all' && canViewAdmin) {
    const b = { flagged: [], duplicate: [], dead: [], corrected: [], clean: [] };
    for (const s of shown) {
      if (isDead(s)) b.dead.push(s);
      else if (isRed(s._id)) b.flagged.push(s);
      else if (isDuplicate(s)) b.duplicate.push(s);
      else if (isCorrected(s)) b.corrected.push(s);
      else b.clean.push(s);
    }
    sections = [
      { key: 'flagged', label: '🚩 Red flags', items: b.flagged },
      { key: 'duplicate', label: '👯 Duplicate', items: b.duplicate },
      { key: 'dead', label: '🗑️ Dead', items: b.dead },
      { key: 'corrected', label: '✎ Corrected', items: b.corrected },
      { key: 'clean', label: '✨ Clean', items: b.clean },
    ].filter((sec) => sec.items.length > 0);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">{isGuest ? 'Submissions (demo)' : isAdmin ? 'Submissions' : 'My Submissions'}</h2>
          <p className="text-sm text-slate-500">
            {shown.length} shown
            {canSeeFlags && <> · {filteredFlagCount} flagged</>}
            {isGuest && <> · demo view, limited to {guestCap}</>}
            {!isAdmin && !isGuest && <> · only the readings you sent</>}
          </p>
        </div>
        {canDownload && (
          <Suspense fallback={<div className="h-9 w-24 bg-slate-200 rounded animate-pulse" />}>
            <ExportButton />
          </Suspense>
        )}
      </div>

      <Suspense fallback={<div className="h-12 bg-slate-100 rounded-lg animate-pulse" />}>
        <FilterBar />
      </Suspense>

      {(canSeeFlags || canViewAdmin) && (
        <>
          {!isAdmin && !isGuest && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              These are readings the reviewer flagged for you to double-check.
            </div>
          )}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {canViewAdmin ? (
              <>
                <FlagChip name="all" current={flagFilter} sp={sp}>All ({totalCount})</FlagChip>
                <FlagChip name="raw" current={flagFilter} sp={sp}>🗂️ Raw ({rawCount})</FlagChip>
                <FlagChip name="flagged" current={flagFilter} sp={sp} danger>🚩 Red flags ({redCount})</FlagChip>
                {duplicateCount > 0 && <FlagChip name="duplicates" current={flagFilter} sp={sp}>👯 Duplicate ({duplicateCount})</FlagChip>}
                <FlagChip name="dead" current={flagFilter} sp={sp}>🗑️ Dead ({deadCount})</FlagChip>
                <FlagChip name="corrected" current={flagFilter} sp={sp}>✎ Corrected ({correctedCount})</FlagChip>
                <FlagChip name="clean" current={flagFilter} sp={sp}>✨ Clean ({cleanCount})</FlagChip>
              </>
            ) : (
              <>
                <FlagChip name="all" current={flagFilter} sp={sp}>All</FlagChip>
                <FlagChip name="clean" current={flagFilter} sp={sp}>✓ Clean</FlagChip>
                <FlagChip name="flagged" current={flagFilter} sp={sp} danger>🚩 Flagged ({redCount})</FlagChip>
              </>
            )}
          </div>
          {isAdmin && (
            <p className="text-[11px] text-slate-500 -mt-1">
              <b>All ({totalCount})</b> and <b>Raw ({rawCount})</b> are the whole dataset — every submission — so they’re the biggest tabs. Raw just shows each form <i>exactly as Kobo stored it</i> (no edits). <b>Clean</b>, <b>Corrected</b>, <b>Dead</b> and <b>Duplicate</b> are smaller subsets of it.
            </p>
          )}
        </>
      )}

      <SubmissionList
        submissions={shown}
        flags={allFlags}
        allSubmissions={isGuest ? shown : scopedAll}
        canVerify={canEdit}
        verifiedIds={canSeeFlags ? Array.from(verifiedIds) : []}
        duplicates={canViewAdmin ? dup.map : {}}
        sections={sections}
      />
    </div>
  );
}

function FlagChip({ name, current, sp, danger, children }) {
  const active = (current || 'all') === name;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp || {})) {
    if (k !== 'flag' && v) params.set(k, Array.isArray(v) ? v[0] : String(v));
  }
  if (name !== 'all') params.set('flag', name);
  const href = `/submissions${params.toString() ? '?' + params.toString() : ''}`;
  return (
    <a href={href} className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition ${
      active ? (danger ? 'bg-red-600 text-white border-red-600' : 'bg-brand-600 text-white border-brand-600') : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
    }`}>{children}</a>
  );
}
