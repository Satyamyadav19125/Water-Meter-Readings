import { Suspense } from 'react';
import { fetchSubmissions } from '@/lib/kobo';
import { filterSubmissionsForUser, applyUrlFilters } from '@/lib/filter';
import { getField } from '@/lib/fieldMap';
import MapView from '@/components/MapView';
import FilterBar from '@/components/FilterBar';
import MapExportButton from '@/components/MapExportButton';

export const dynamic = 'force-dynamic';

function parseLocation(val) {
  if (val == null) return null;
  if (typeof val === 'object') {
    const lat = val.latitude ?? val.lat ?? val.y;
    const lng = val.longitude ?? val.lng ?? val.lon ?? val.x;
    if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng };
    return null;
  }
  const parts = String(val).trim().split(/\s+/).map((x) => Number(x));
  if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
    return { lat: parts[0], lng: parts[1] };
  }
  return null;
}

export default async function MapPage({ searchParams }) {
  const sp = (await searchParams) || {};
  let submissions = [];
  let error = null;
  try { submissions = await fetchSubmissions(); }
  catch (e) { error = e.message; }

  if (error) return <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800 text-sm">{error}</div>;

  submissions = await filterSubmissionsForUser(submissions);
  submissions = applyUrlFilters(submissions, sp);

  const points = [];
  for (const s of submissions) {
    const loc = parseLocation(getField(s, 'location')) || parseLocation(s._geolocation);
    if (loc) {
      points.push({
        id: s._id,
        lat: loc.lat,
        lng: loc.lng,
        village: getField(s, 'village') || 'Unknown',
        serial: getField(s, 'serial') || 'Unknown',
        reading: getField(s, 'endReading') ?? '—',
        surveyor: getField(s, 'surveyor') || 'Unknown',
        time: s._submission_time,
      });
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">🗺️ Map</h2>
          <p className="text-sm text-slate-500">
            {points.length} submissions with GPS · tap a pin → see reading + Google Maps link
          </p>
        </div>
        <Suspense fallback={<div className="h-9 w-32 bg-slate-200 rounded animate-pulse" />}>
          <MapExportButton />
        </Suspense>
      </div>

      <Suspense fallback={<div className="h-12 bg-slate-100 rounded-lg animate-pulse" />}>
        <FilterBar />
      </Suspense>

      {points.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-6 text-center text-slate-500">
          No submissions match the current filters, or they don't have GPS data.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <MapView points={points} />
        </div>
      )}
    </div>
  );
}
