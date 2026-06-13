import { Suspense } from 'react';
import { fetchSubmissions, findAttachmentUrl } from '@/lib/kobo';
import { filterSubmissionsForUser, applyUrlFilters } from '@/lib/filter';
import { getField } from '@/lib/fieldMap';
import FilterBar from '@/components/FilterBar';
import KoboTable from '@/components/KoboTable';
import ExportButton from '@/components/ExportButton';

export const dynamic = 'force-dynamic';

function fmtLoc(val) {
  if (val == null) return '';
  if (typeof val === 'string') {
    const parts = val.trim().split(/\s+/);
    if (parts.length >= 2) return `${Number(parts[0]).toFixed(5)}, ${Number(parts[1]).toFixed(5)}`;
  }
  if (Array.isArray(val) && val.length >= 2) return `${val[0]}, ${val[1]}`;
  return '';
}
function latlng(val, geo) {
  let lat, lng;
  if (typeof val === 'string') {
    const p = val.trim().split(/\s+/).map(Number);
    if (p.length >= 2) { lat = p[0]; lng = p[1]; }
  }
  if ((lat == null || lng == null) && Array.isArray(geo) && geo.length >= 2) { lat = geo[0]; lng = geo[1]; }
  return { lat, lng };
}

export default async function KoboViewPage({ searchParams }) {
  const sp = (await searchParams) || {};
  let submissions = [];
  let error = null;
  try { submissions = await fetchSubmissions(); }
  catch (e) { error = e.message; }

  if (error) return <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800 text-sm">{error}</div>;

  submissions = await filterSubmissionsForUser(submissions);
  submissions = applyUrlFilters(submissions, sp);

  const sorted = [...submissions].sort((a, b) => new Date(b._submission_time).getTime() - new Date(a._submission_time).getTime());

  const rows = sorted.map((s) => {
    const locRaw = getField(s, 'location');
    const { lat, lng } = latlng(locRaw, s._geolocation);
    const photoName = getField(s, 'photo');
    let photo = null;
    if (photoName) {
      const direct = findAttachmentUrl(s, photoName);
      photo = direct ? `/api/photo?url=${encodeURIComponent(direct)}` : null;
    } else if (s._attachments?.[0]?.download_url) {
      photo = `/api/photo?url=${encodeURIComponent(s._attachments[0].download_url)}`;
    }
    return {
      id: s._id,
      validation: (s._validation_status && s._validation_status.label) || '',
      start: getField(s, 'startTime') || '',
      end: getField(s, 'endTime') || '',
      date: getField(s, 'date') || '',
      time: getField(s, 'endTime') || getField(s, 'startTime') || '',
      gps: fmtLoc(locRaw) || (Array.isArray(s._geolocation) ? s._geolocation.map((x) => x?.toFixed?.(5) ?? x).join(', ') : ''),
      lat, lng,
      surveyor: getField(s, 'surveyor') || '',
      village: getField(s, 'village') || 'Unknown',
      meter: getField(s, 'serial') || '',
      reading: getField(s, 'endReading') ?? '',
      photo,
      submitted: new Date(s._submission_time).toLocaleString(),
    };
  });

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">🪞 Kobo Data View</h2>
          <p className="text-sm text-slate-500">Spreadsheet view of all submissions, like the KoboToolbox table. Search any column, tap a row number to expand. {rows.length.toLocaleString()} rows shown.</p>
        </div>
        <Suspense fallback={<div className="h-9 w-24 bg-slate-200 rounded animate-pulse" />}>
          <ExportButton />
        </Suspense>
      </div>

      <Suspense fallback={<div className="h-12 bg-slate-100 rounded-lg animate-pulse" />}>
        <FilterBar />
      </Suspense>

      <KoboTable rows={rows} />
    </div>
  );
}
