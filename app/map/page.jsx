import { Suspense } from 'react';
import { fetchSubmissions } from '@/lib/kobo';
import { filterSubmissionsForUser, applyUrlFilters } from '@/lib/filter';
import { getField } from '@/lib/fieldMap';
import { detectFlagsScoped } from '@/lib/flagContext';
import { sameDayDuplicates } from '@/lib/redflags';
import { getSettings, getVerifiedIds, getDisabledRegistry } from '@/lib/db';
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
  let verifiedIds = new Set();
  let error = null;
  try {
    [submissions, settings, verifiedIds] = await Promise.all([fetchSubmissions(), getSettings(), getVerifiedIds()]);
  } catch (e) { error = e.message; }

  if (error) return <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800 text-sm">{error}</div>;

  const currentUser = await getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';
  const isGuest = currentUser?.role === 'guest';
  const canViewAdmin = isAdmin || isGuest; // guest sees flags/duplicates but read-only
  const guestCap = isGuest ? Math.max(1, Number(currentUser?.maxReadings) || 10) : 0;

  const scoped0 = await filterSubmissionsForUser(submissions);
  // Surveyors see all their pins as clean — no red flag indicators on the map.
  const flags = canViewAdmin ? await detectFlagsScoped(scoped0, settings) : {};
  // Drop dead (mistake) readings from the map — they remain in the Submissions
  // list for admins to review/revert. Farms/meters switched OFF in Settings are
  // NOT dropped: they have real Kobo forms, so their pins still show (marked
  // "off"); they're only left OUT of the target/coverage counts.
  const lcm = (x) => String(x || '').trim().toLowerCase();
  const dReg = await getDisabledRegistry().catch(() => ({ farms: [], pipes: [] }));
  const offF = new Set((dReg.farms || []).map(lcm));
  const offP = new Set((dReg.pipes || []).map(lcm));
  const isOff = (s) => offF.has(lcm(getField(s, 'farm'))) || offP.has(lcm(getField(s, 'serial')));
  let scoped = applyUrlFilters(scoped0, sp).filter((s) => !s._dead);
  // Guests see only a small sample of pins (no bulk location harvesting).
  if (guestCap) scoped = scoped.slice(0, guestCap);

  // Same-day duplicate readings, so the map can filter to them.
  const dupIds = canViewAdmin ? sameDayDuplicates(scoped).ids : new Set();

  const points = [];
  for (const s of scoped) {
    const loc = parseLocation(getField(s, 'location')) || parseLocation(s._geolocation);
    if (loc) {
      const f = flags[s._id];
      const flagged = canViewAdmin && !!f && !verifiedIds.has(String(s._id));
      points.push({
        id: s._id, lat: loc.lat, lng: loc.lng,
        isDuplicate: dupIds.has(String(s._id)),
        isOff: isOff(s),
        village: getField(s, 'village') || 'Unknown',
        serial: getField(s, 'serial') || 'Unknown',
        reading: getField(s, 'endReading') ?? getField(s, 'reading') ?? '—',
        date: getField(s, 'date') || '—',
        photoCount: (s._attachments || []).filter((a) => !a.is_deleted).length,
        surveyor: getField(s, 'surveyor') || 'Unknown',
        time: s._submission_time,
        isFlagged: flagged,
        flagTypes: flagged ? f.flags.map((x) => x.type) : [],
      });
    }
  }
  const flaggedOnMap = points.filter((p) => p.isFlagged).length;
  // Count flags across ALL filtered submissions — including ones without GPS
  // that can't be drawn as pins — so this number always matches the
  // Submissions page instead of silently under-reporting.
  const flaggedTotal = scoped.filter(
    (s) => flags[s._id] && !verifiedIds.has(String(s._id))
  ).length;
  const flaggedNoGps = flaggedTotal - flaggedOnMap;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">🗺️ Map</h2>
          <p className="text-sm text-slate-500">
            {points.length} with GPS
            {isAdmin && <> · <span className="text-red-600 font-medium">{flaggedTotal} flagged</span>
              {flaggedNoGps > 0 && <span className="text-slate-400"> ({flaggedNoGps} without GPS — not on map)</span>}</>}
            {isGuest && <> · demo view, limited to {guestCap}</>}
            {' '}· tap a pin for details
          </p>
        </div>
        {isAdmin && (
          <Suspense fallback={<div className="h-9 w-32 bg-slate-200 rounded animate-pulse" />}>
            <MapExportButton />
          </Suspense>
        )}
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
          <MapView points={points} showFlagFilter={canViewAdmin} allowKoboLink={isAdmin} />
        </div>
      )}
    </div>
  );
}
