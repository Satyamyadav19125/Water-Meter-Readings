import { Suspense } from 'react';
import { fetchSubmissions } from '@/lib/kobo';
import { filterSubmissionsForUser, applyUrlFilters, applyWhoFilter } from '@/lib/filter';
import { getField } from '@/lib/fieldMap';
import { detectRedFlags } from '@/lib/redflags';
import { getSettings } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
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
  if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) return { lat: parts[0], lng: parts[1] };
  return null;
}

export default async function MapPage({ searchParams }) {
  const sp = (await searchParams) || {};
  let submissions = [];
  let settings;
  let error = null;
  try {
    [submissions, settings] = await Promise.all([fetchSubmissions(), getSettings()]);
  } catch (e) { error = e.message; }

  if (error) return <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800 text-sm">{error}</div>;

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

  const points = [];
  for (const s of scoped) {
    const loc = parseLocation(getField(s, 'location')) || parseLocation(s._geolocation);
    if (loc) {
      const f = flags[s._id];
      points.push({
        id: s._id, lat: loc.lat, lng: loc.lng,
        village: getField(s, 'village') || 'Unknown',
        serial: getField(s, 'serial') || 'Unknown',
        reading: getField(s, 'endReading') ?? '—',
        surveyor: getField(s, 'surveyor') || 'Unknown',
        time: s._submission_time,
        isFlagged: !!f,
        flagTypes: f ? f.flags.map((x) => x.type) : [],
      });
    }
  }
  const flaggedTotal = points.filter((p) => p.isFlagged).length;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">🗺️ Map</h2>
          <p className="text-sm text-slate-500">
            {points.length} with GPS · <span className="text-red-600 font-medium">{flaggedTotal} flagged</span> · tap a pin for details
          </p>
          {isUser && (
            <p className="text-xs text-slate-500 mt-0.5">
              🚩 <span className="text-red-600 font-medium">{mineFlagged}</span> flagged by you ·{' '}
              <span className="text-amber-600 font-medium">{othersFlagged}</span> flagged by others in your villages
            </p>
          )}
        </div>
        <Suspense fallback={<div className="h-9 w-32 bg-slate-200 rounded animate-pulse" />}>
          <MapExportButton />
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

function WhoChip({ name, current, sp, children }) {
  const active = (current || 'all') === name;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp || {})) {
    if (k !== 'who' && v) params.set(k, Array.isArray(v) ? v[0] : String(v));
  }
  if (name !== 'all') params.set('who', name);
  const href = `/map${params.toString() ? '?' + params.toString() : ''}`;
  return (
    <a href={href} className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition ${
      active ? 'bg-field-600 text-white border-field-600' : 'bg-white text-slate-700 border-slate-300 hover:border-field-500'
    }`}>{children}</a>
  );
}
