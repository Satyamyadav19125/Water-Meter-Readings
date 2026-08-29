'use client';

import { useEffect, useRef, useState } from 'react';

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const LEAFLET_HEAT_JS = 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js';

const TILE_LAYERS = {
  // maxNativeZoom caps the deepest tile actually fetched; Leaflet UPSCALES past
  // it instead of asking for tiles that don't exist (which showed "map data not
  // available"). Esri imagery over rural areas often stops around z17-18.
  street: { name: '🗺️ Street', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap', maxNativeZoom: 19 },
  satellite: { name: '🛰️ Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles © Esri', maxNativeZoom: 17 },
  topo: { name: '⛰️ Topo', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attribution: '© OpenTopoMap', maxNativeZoom: 17 },
};

const stopMapGestures = {
  onClick: (e) => e.stopPropagation(),
  onDoubleClick: (e) => e.stopPropagation(),
  onMouseDown: (e) => e.stopPropagation(),
  onTouchStart: (e) => e.stopPropagation(),
  onWheel: (e) => e.stopPropagation(),
};

function escapeHtml(s) {
  return String(s ?? '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Pin colours as hex. Markers are drawn on ONE <canvas> (preferCanvas) instead
// of 1000+ downloaded PNG icons + DOM nodes — the big speed win that keeps the
// map smooth with the whole dataset pinned.
const PIN_COLORS = { red: '#dc2626', blue: '#2563eb', orange: '#f59e0b', grey: '#94a3b8' };

function loadScript(id, src) {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(id);
    if (existing) {
      if (existing.dataset.loaded) return resolve();
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.id = id; script.src = src; script.async = true;
    script.onload = () => { script.dataset.loaded = '1'; resolve(); };
    script.onerror = reject;
    document.body.appendChild(script);
  });
}
function loadCss(id, href) {
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id; link.rel = 'stylesheet'; link.href = href;
  document.head.appendChild(link);
}

function popupHtml(p, { showFlagFilter, allowKoboLink }) {
  const dir = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
  const showRed = showFlagFilter && p.isFlagged;
  const flagHtml = (showRed && p.flagTypes?.length)
    ? `<div style="margin-top:6px;padding:6px 8px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;font-size:11px;color:#991b1b;">🚩 ${escapeHtml(p.flagTypes.join(', '))}</div>`
    : '';
  const offHtml = p.isOff
    ? `<div style="margin-top:6px;padding:5px 8px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px;font-size:11px;color:#475569;">⚙️ This farm/meter is turned <b>off</b> in Settings — shown because it has a real Kobo form, but left out of the target &amp; coverage counts.</div>`
    : '';
  const viewLink = allowKoboLink
    ? `<a target="_blank" href="/kobo-view?id=${encodeURIComponent(p.id)}" style="background:#0ea5e9;color:white;font-size:11px;padding:5px 10px;border-radius:5px;text-decoration:none;">View submission</a>`
    : '';
  return `
    <div style="min-width: 210px; font-family: system-ui, sans-serif;">
      <div style="font-weight: 600; color: ${showRed ? '#991b1b' : '#0c4a6e'}; margin-bottom: 4px;">
        ${showRed ? '🚩' : '📍'} ${escapeHtml(p.village)}
      </div>
      <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">${new Date(p.time).toLocaleString()}</div>
      <table style="width: 100%; font-size: 12px;">
        <tr><td style="color:#64748b;padding:1px 0;">Meter</td><td style="font-family:monospace;">${escapeHtml(p.serial)}</td></tr>
        <tr><td style="color:#64748b;padding:1px 0;">Reading</td><td style="font-weight:600;">${escapeHtml(p.reading)}</td></tr>
        <tr><td style="color:#64748b;padding:1px 0;">Form date</td><td>${escapeHtml(p.date ?? '—')}</td></tr>
        <tr><td style="color:#64748b;padding:1px 0;">Surveyor</td><td>${escapeHtml(p.surveyor)}</td></tr>
        <tr><td style="color:#64748b;padding:1px 0;">Photos</td><td>${escapeHtml(String(p.photoCount ?? 0))} 📷</td></tr>
        <tr><td style="color:#64748b;padding:1px 0;">GPS</td><td style="font-family:monospace;font-size:11px;">${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</td></tr>
      </table>
      ${flagHtml}
      ${offHtml}
      <div style="margin-top: 8px; display:flex; gap:6px; flex-wrap:wrap;">
        ${viewLink}
        <a target="_blank" href="${dir}" style="background:#16a34a;color:white;font-size:11px;padding:5px 10px;border-radius:5px;text-decoration:none;">🧭 Directions</a>
      </div>
    </div>`;
}

export default function MapView({ points = [], showFlagFilter = true, allowKoboLink = true }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const canvasRef = useRef(null);       // shared canvas renderer for all pins
  const layerGroupRef = useRef(null);   // holds every pin (no clustering)
  const heatRef = useRef(null);
  const heatTapRef = useRef([]);
  const myMarkerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [layer, setLayer] = useState('satellite');
  // ONE filter drives everything: all | clean | flagged | duplicates | off
  const [filterMode, setFilterMode] = useState('all');
  const [viewMode, setViewMode] = useState('pins');   // pins | heat
  const [locating, setLocating] = useState(false);
  const [emptyFilter, setEmptyFilter] = useState(false);

  const flaggedCount = points.filter((p) => p.isFlagged).length;
  const cleanCount = points.length - flaggedCount;
  const dupCount = points.filter((p) => p.isDuplicate).length;
  const offCount = points.filter((p) => p.isOff).length;

  // ---- Create the map ONCE. ----
  useEffect(() => {
    let cancelled = false;
    loadCss('leaflet-css', LEAFLET_CSS);
    (async () => {
      try {
        await loadScript('leaflet-js', LEAFLET_JS);
        await loadScript('leaflet-heat-js', LEAFLET_HEAT_JS);
        const L = window.L;
        if (cancelled || !containerRef.current || !L || mapRef.current) return;
        const map = L.map(containerRef.current, { zoomControl: true, preferCanvas: true }).setView([30.9, 75.8], 9);
        mapRef.current = map;
        // `tolerance` grows the invisible tap area around each canvas dot so pins
        // are easy to tap on a phone (a 7px dot alone is a tiny target).
        canvasRef.current = L.canvas({ padding: 0.5, tolerance: 10 });
        const conf = TILE_LAYERS[layer];
        tileLayerRef.current = L.tileLayer(conf.url, { maxZoom: 19, maxNativeZoom: conf.maxNativeZoom || 19, attribution: conf.attribution }).addTo(map);
        attachStreetFallback(L, map, tileLayerRef);
        setTimeout(() => { try { map.invalidateSize(); } catch {} }, 200);
        setTimeout(() => { try { map.invalidateSize(); } catch {} }, 900);
        if (!cancelled) setReady(true);
      } catch (e) { console.error('Leaflet load failed', e); }
    })();
    return () => { cancelled = true; if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } setReady(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Rebuild markers whenever the data / colouring changes. ----
  useEffect(() => {
    const map = mapRef.current;
    const L = typeof window !== 'undefined' ? window.L : null;
    if (!map || !L || !ready) return;
    const renderer = canvasRef.current || L.canvas({ padding: 0.5, tolerance: 10 });
    const built = [];
    for (const p of points) {
      let key = 'blue';
      if (showFlagFilter && p.isFlagged) key = 'red';
      else if (p.isOff) key = 'grey';   // farm/meter turned off, but still shown
      const flaggedPin = showFlagFilter && p.isFlagged;
      const m = L.circleMarker([p.lat, p.lng], {
        renderer,
        radius: flaggedPin ? 8 : 7,
        color: '#ffffff', weight: 1.5, fillColor: PIN_COLORS[key] || PIN_COLORS.blue, fillOpacity: 0.95,
        bubblingMouseEvents: false,
      });
      // Tap a pin → full details popup (works on phone thanks to the renderer
      // tap tolerance above).
      m.bindPopup(popupHtml(p, { showFlagFilter, allowKoboLink }));
      built.push({ marker: m, isFlagged: !!p.isFlagged, lat: p.lat, lng: p.lng, point: p });
    }
    map._meterMarkers = built;
    applyView(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, showFlagFilter, ready, allowKoboLink]);

  function matchesFilter(item) {
    const p = item && item.point ? item.point : null;
    if (filterMode === 'off') return p ? !!p.isOff : false;   // ONLY turned-off units
    if (filterMode === 'duplicates') return p ? !!p.isDuplicate : false;
    if (!showFlagFilter) return true;                 // surveyors: every pin
    const isFlagged = p ? p.isFlagged : false;
    if (filterMode === 'flagged') return isFlagged;   // ONLY red-flagged pins
    if (filterMode === 'clean') return !isFlagged;
    return true;                                       // 'all'
  }

  function applyView(mapArg) {
    const map = mapArg || mapRef.current;
    const L = typeof window !== 'undefined' ? window.L : null;
    if (!map || !L) return;
    const all = map._meterMarkers || [];
    // clear heat + taps + the pin layer
    if (heatRef.current) { map.removeLayer(heatRef.current); heatRef.current = null; }
    for (const t of heatTapRef.current) map.removeLayer(t);
    heatTapRef.current = [];
    if (layerGroupRef.current) { map.removeLayer(layerGroupRef.current); layerGroupRef.current = null; }

    const shownItems = all.filter(matchesFilter);

    if (viewMode === 'pins') {
      // Every pin, drawn directly (no clustering).
      const grp = L.layerGroup(shownItems.map((i) => i.marker));
      grp.addTo(map);
      layerGroupRef.current = grp;
    } else if (viewMode === 'heat' && typeof L.heatLayer === 'function') {
      const heatPts = shownItems.map((i) => [i.lat, i.lng, i.isFlagged ? 1.0 : 0.5]);
      if (heatPts.length) heatRef.current = L.heatLayer(heatPts, { radius: 28, blur: 18, maxZoom: 17, minOpacity: 0.35 }).addTo(map);
      for (const it of shownItems) {
        const tap = L.circleMarker([it.lat, it.lng], { radius: 13, stroke: false, fillColor: '#f97316', fillOpacity: 0.06, interactive: true, bubblingMouseEvents: false });
        const content = it.marker.getPopup()?.getContent?.();
        if (content) tap.bindPopup(content);
        tap.addTo(map); heatTapRef.current.push(tap);
      }
    }

    setEmptyFilter(shownItems.length === 0 && all.length > 0);
    if (shownItems.length > 0) {
      try { map.fitBounds(L.featureGroup(shownItems.map((i) => i.marker)).getBounds().pad(0.25), { maxZoom: 13 }); } catch {}
    }
  }

  useEffect(() => { applyView(); /* eslint-disable-next-line */ }, [filterMode, viewMode]);

  useEffect(() => {
    const L = typeof window !== 'undefined' ? window.L : null;
    if (!L || !mapRef.current) return;
    if (tileLayerRef.current) mapRef.current.removeLayer(tileLayerRef.current);
    const conf = TILE_LAYERS[layer];
    tileLayerRef.current = L.tileLayer(conf.url, { maxZoom: 19, maxNativeZoom: conf.maxNativeZoom || 19, attribution: conf.attribution }).addTo(mapRef.current);
    attachStreetFallback(L, mapRef.current, tileLayerRef);
  }, [layer]);

  function goToMyLocation() {
    const L = window.L; const map = mapRef.current;
    if (!L || !map) return;
    if (!navigator.geolocation) { alert('Location is not available on this device/browser.'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude, accuracy } = pos.coords;
        if (myMarkerRef.current) map.removeLayer(myMarkerRef.current);
        const dot = L.circleMarker([latitude, longitude], { radius: 8, color: '#ffffff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }).addTo(map).bindPopup('📍 You are here');
        const circle = L.circle([latitude, longitude], { radius: Math.min(accuracy || 30, 200), color: '#2563eb', weight: 1, fillOpacity: 0.1 });
        circle.addTo(map);
        myMarkerRef.current = L.featureGroup([dot, circle]);
        map.setView([latitude, longitude], 16);
        dot.openPopup();
      },
      () => { setLocating(false); alert('Could not get your location. Allow location access and try again.'); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div className="relative">
      {/* ONE filter bar. "🚩 Flagged" / "⚙️ Off" actually FILTER the map. */}
      {showFlagFilter && (
        <div className="absolute top-2 left-12 sm:left-14 z-[450] bg-white rounded-lg shadow inline-flex flex-wrap p-0.5 text-[11px] sm:text-xs gap-0.5 max-w-[calc(100%-7rem)]" {...stopMapGestures}>
          <FilterBtn active={filterMode === 'all'} onClick={() => setFilterMode('all')}>All ({points.length})</FilterBtn>
          <FilterBtn active={filterMode === 'clean'} onClick={() => setFilterMode('clean')} color="text-sky-700">● Clean ({cleanCount})</FilterBtn>
          <FilterBtn active={filterMode === 'flagged'} onClick={() => setFilterMode('flagged')} color="text-red-700">🚩 Flagged ({flaggedCount})</FilterBtn>
          {dupCount > 0 && <FilterBtn active={filterMode === 'duplicates'} onClick={() => setFilterMode('duplicates')} color="text-indigo-700">👯 Duplicate ({dupCount})</FilterBtn>}
          {offCount > 0 && <FilterBtn active={filterMode === 'off'} onClick={() => setFilterMode('off')} color="text-slate-600">⚙️ Off ({offCount})</FilterBtn>}
        </div>
      )}

      <div className="absolute top-12 left-12 sm:left-14 z-[450] bg-white rounded-lg shadow flex p-0.5 text-[11px] sm:text-xs" {...stopMapGestures}>
        <FilterBtn active={viewMode === 'pins'} onClick={() => setViewMode('pins')}>📍 Pins</FilterBtn>
        <FilterBtn active={viewMode === 'heat'} onClick={() => setViewMode('heat')} color="text-orange-700">🔥 Heat</FilterBtn>
      </div>

      <div className="absolute top-2 right-2 z-[450] bg-white rounded-lg shadow flex flex-col p-1 gap-0.5" {...stopMapGestures}>
        {Object.entries(TILE_LAYERS).map(([k, v]) => (
          <button key={k} onClick={() => setLayer(k)}
            className={`text-[11px] sm:text-xs px-2 py-1 rounded text-left whitespace-nowrap ${layer === k ? 'bg-brand-100 text-brand-900 font-semibold' : 'hover:bg-slate-100'}`}>
            {v.name}
          </button>
        ))}
      </div>

      <button onClick={goToMyLocation} title="Go to my location"
        className="absolute bottom-6 right-2 z-[450] w-11 h-11 bg-white rounded-full shadow-lg flex items-center justify-center text-xl hover:bg-slate-50 active:scale-95 transition" onDoubleClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
        {locating ? <span className="animate-spin text-base">⏳</span> : '🎯'}
      </button>

      {emptyFilter && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[440] bg-white/90 rounded-lg shadow px-4 py-2 text-sm text-slate-600 text-center pointer-events-none">
          No pins match this filter{filterMode === 'flagged' ? ' — there are no red-flagged readings here.' : filterMode === 'off' ? ' — no turned-off farms/meters have GPS here.' : '.'}
        </div>
      )}
      <div ref={containerRef} style={{ height: '70vh', minHeight: 420, width: '100%' }} />
    </div>
  );
}

function attachStreetFallback(L, map, tileLayerRef) {
  const t = tileLayerRef.current;
  if (!t || !t._url || !t._url.includes('openstreetmap.org')) return;
  let errors = 0;
  t.on('tileerror', () => {
    errors += 1;
    if (errors === 4 && map.hasLayer(t)) {
      map.removeLayer(t);
      tileLayerRef.current = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19, attribution: '© OpenStreetMap © CARTO' }).addTo(map);
    }
  });
}

function FilterBtn({ active, onClick, children, color = 'text-slate-700' }) {
  return (
    <button onClick={onClick}
      className={`px-2 py-1 rounded whitespace-nowrap ${active ? 'bg-brand-100 font-semibold ' + color : 'hover:bg-slate-100 ' + color}`}>
      {children}
    </button>
  );
}
