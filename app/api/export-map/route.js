import { fetchSubmissions } from '@/lib/kobo';
import { filterSubmissionsForUser, applyUrlFilters } from '@/lib/filter';
import { getField } from '@/lib/fieldMap';

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

function escapeXml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') || 'csv').toLowerCase();

    let subs = await fetchSubmissions();
    subs = await filterSubmissionsForUser(subs);
    subs = applyUrlFilters(subs, searchParams);

    const points = [];
    for (const s of subs) {
      const loc = parseLocation(getField(s, 'location')) || parseLocation(s._geolocation);
      if (loc) {
        points.push({
          id: s._id, lat: loc.lat, lng: loc.lng,
          village: getField(s, 'village') || 'Unknown',
          serial: getField(s, 'serial') || 'Unknown',
          reading: getField(s, 'endReading') ?? '',
          surveyor: getField(s, 'surveyor') || 'Unknown',
          time: s._submission_time,
        });
      }
    }

    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    if (format === 'json' || format === 'geojson') {
      const geo = {
        type: 'FeatureCollection',
        features: points.map((p) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
          properties: { id: p.id, village: p.village, meter: p.serial, reading: p.reading, surveyor: p.surveyor, time: p.time },
        })),
      };
      return new Response(JSON.stringify(geo, null, 2), {
        headers: {
          'Content-Type': 'application/geo+json; charset=utf-8',
          'Content-Disposition': `attachment; filename="water-meter-map-${ts}.geojson"`,
        },
      });
    }

    if (format === 'kml') {
      const placemarks = points.map((p) => `
    <Placemark>
      <name>${escapeXml(p.village)} - ${escapeXml(p.serial)}</name>
      <description><![CDATA[
        <b>Reading:</b> ${escapeXml(p.reading)}<br/>
        <b>Surveyor:</b> ${escapeXml(p.surveyor)}<br/>
        <b>Time:</b> ${escapeXml(p.time)}<br/>
        <b>Submission #</b>${escapeXml(p.id)}
      ]]></description>
      <Point><coordinates>${p.lng},${p.lat},0</coordinates></Point>
    </Placemark>`).join('');
      const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Water Meter Readings ${ts}</name>
    <description>Exported from Water Meter Dashboard</description>
    ${placemarks}
  </Document>
</kml>`;
      return new Response(kml, {
        headers: {
          'Content-Type': 'application/vnd.google-earth.kml+xml; charset=utf-8',
          'Content-Disposition': `attachment; filename="water-meter-map-${ts}.kml"`,
        },
      });
    }

    if (format === 'html') {
      const safePoints = JSON.stringify(points);
      const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"><title>Water Meter Map ${ts}</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>body,html,#map{margin:0;height:100vh;font-family:system-ui}</style>
</head><body><div id="map"></div>
<script>
const points = ${safePoints};
const map = L.map('map').setView([30.9, 75.8], 9);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {attribution:'OpenStreetMap'}).addTo(map);
const markers = points.map(p => {
  const m = L.marker([p.lat, p.lng]).addTo(map);
  m.bindPopup('<b>' + p.village + '</b><br/>Meter: ' + p.serial + '<br/>Reading: ' + p.reading + '<br/>By: ' + p.surveyor + '<br/><a target="_blank" href="https://www.google.com/maps?q=' + p.lat + ',' + p.lng + '">Open in Google Maps</a>');
  return m;
});
if (markers.length) map.fitBounds(L.featureGroup(markers).getBounds().pad(0.2));
</script></body></html>`;
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `attachment; filename="water-meter-map-${ts}.html"`,
        },
      });
    }

    const lines = ['Submission ID,Village,Meter Serial,Reading,Surveyor,Latitude,Longitude,Time,Google Maps Link'];
    for (const p of points) {
      const cells = [p.id, p.village, p.serial, p.reading, p.surveyor, p.lat, p.lng, p.time, `https://www.google.com/maps?q=${p.lat},${p.lng}`];
      lines.push(cells.map((c) => {
        const v = String(c ?? '');
        return /[,"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
      }).join(','));
    }
    return new Response('\uFEFF' + lines.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="water-meter-map-${ts}.csv"`,
      },
    });
  } catch (e) {
    return new Response(`Export error: ${e.message}`, { status: 500 });
  }
}
