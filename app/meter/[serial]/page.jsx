import { Suspense } from 'react';
import Link from 'next/link';
import { fetchSubmissions } from '@/lib/kobo';
import { filterSubmissionsForUser } from '@/lib/filter';
import { getSettings, getVerifiedIds } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getField, parseReading } from '@/lib/fieldMap';
import { detectRedFlags, groupBySerial } from '@/lib/redflags';
import SubmissionList from '@/components/SubmissionList';
import ExportButton from '@/components/ExportButton';

export const dynamic = 'force-dynamic';

export default async function MeterPage({ params }) {
  const resolvedParams = await params;
  const serial = decodeURIComponent(resolvedParams.serial);

  let submissions = await fetchSubmissions();
  const [settings, verifiedIds, currentUser] = await Promise.all([getSettings(), getVerifiedIds(), getCurrentUser()]);
  submissions = await filterSubmissionsForUser(submissions);

  const groups = groupBySerial(submissions);
  const mine = groups[serial] || [];
  const flags = detectRedFlags(submissions, { enabled: settings?.redFlags });

  const sorted = [...mine].sort(
    (a, b) => new Date(b._submission_time).getTime() - new Date(a._submission_time).getTime()
  );

  const village = sorted[0] ? getField(sorted[0], 'village') : null;
  const latest = sorted[0] ? parseReading(getField(sorted[0], 'endReading')) : null;
  const oldest = mine[0] ? parseReading(getField(mine[0], 'endReading')) : null;
  const totalUsage = (latest != null && oldest != null && !Number.isNaN(latest) && !Number.isNaN(oldest))
    ? Math.max(0, latest - oldest) : 0;
  const flaggedHere = sorted.filter((s) => flags[s._id] && !verifiedIds.has(String(s._id))).length;

  return (
    <div className="space-y-4">
      <Link href="/usage" className="inline-flex items-center gap-2 text-sm text-brand-600 hover:underline">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Back to Usage
      </Link>

      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">Meter</div>
          <h1 className="text-xl font-semibold font-mono">{serial}</h1>
          {village && <div className="text-sm text-slate-600">📍 {village}</div>}
        </div>
        <Suspense fallback={<div className="h-9 w-24 bg-slate-200 rounded animate-pulse" />}>
          <ExportButton extraParams={{ meter: serial }} />
        </Suspense>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
        <Stat label="Total submissions" value={mine.length} color="bg-slate-100" />
        <Stat label="Latest reading" value={latest ?? '—'} color="bg-brand-50" />
        <Stat label="Total used" value={total
