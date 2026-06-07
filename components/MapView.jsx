'use client';

import { useEffect, useRef, useState } from 'react';

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

const TILE_LAYERS = {
  street: { name: '🗺️ Street', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap' },
  satellite: { name: '🛰️ Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles © Esri' },
  topo: { name: '⛰️ Topo', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attribution: '© OpenTopoMap' },
};

function escapeHtml(s) {
  return String(s ?? '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Classic Leaflet teardrop markers, just recolored (blue = clean, red = flagged).
const MARKER_SHADOW = 'https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-shadow.png';
function pinIcon(L, color) {
  return L.icon({
    iconUrl: `https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-2x-${color}.png`,
    shadowUrl: MARKER_SHADOW,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
}

export default function MapView({ points = [] }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markersRef = useRef([]);
  const [layer, setLayer] = useState('street');
  const [filterMode, setFilterMode] = useState('all'); // all | clean | flagged

  const flaggedCount = points.filter((p) => p.isFlagged).length;
  const cleanCount = points.length - flaggedCount;

  useEffect(() => {
    let cancelled = false;
    function loadCss() {
      if (document.getElementById('leaflet-css')) return;
      const link = document.createElement('link');
      link.id = 'leaflet-css'; link.rel = 'stylesheet'; link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    function loadJs() {
      return new Promise((resolve, reject) => {
        if (window.L) return resolve(window.L);
        const existing = document.getElementById('leaflet-js');
        if (existing) { existing.addEventListener('load', () => resolve(window.L)); existing.addEventListener('error', reject); return; }
        const script = document.createElement('script');
        script.id = 'leaflet-js'; script.src = LEAFLET_JS; script.async = true;
        script.onload = () => resolve(window.L); script.onerror = reject;
        document.body.appendChild(script);
      });
    }
    loadCss();
    loadJs().then((L) => {
      if (cancelled || !containerRef.current) return;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      const map = L.map(containerRef.current, { zoomControl: true }).setView([30.9, 75.8], 9);
      mapRef.current = map;
      const conf = TILE_LAYERS[layer];
      tileLayerRef.current = L.tileLayer(conf.url, { maxZoom: 19, attribution: conf.attribution }).addTo(map);

      const redIcon = pinIcon(L, 'red');
      const blueIcon = pinIcon(L, 'blue');
      markersRef.current = [];

      for (const p of points) {
        const icon = p.isFlagged ? redIcon : blueIcon;
        const m = L.marker([p.lat, p.lng], { icon });
        const dir = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
        const flagHtml = p.isFlagged && p.flagTypes?.length
          ? `<div style="margin-top:6px;padding:6px 8px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;font-size:11px;color:#991b1b;">🚩 ${escapeHtml(p.flagTypes.join(', '))}</div>`
          : '';
        const popup = `
          <div style="min-width: 210px; font-family: system-ui, sans-serif;">
            <div style="font-weight: 600; color: ${p.isFlagged ? '#991b1b' : '#0c4a6e'}; margin-bottom: 4px;">
              ${p.isFlagged ? '🚩' : '📍'} ${escapeHtml(p.village)}
            </div>
            <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">${new Date(p.time).toLocaleString()}</div>
            <table style="width: 100%; font-size: 12px;">
              <tr><td style="color:#64748b;padding:1px 0;">Meter</td><td style="font-family:monospace;">${escapeHtml(p.serial)}</td></tr>
              <tr><td style="color:#64748b;padding:1px 0;">Reading</td><td style="font-weight:600;">${escapeHtml(p.reading)}</td></tr>
              <tr><td style="color:#64748b;padding:1px 0;">Surveyor</td><td>${escapeHtml(p.surveyor)}</td></tr>
            </table>
            ${flagHtml}
            <div style="margin-top: 8px; display:flex; gap:6px; flex-wrap:wrap;">
              <a target="_blank" href="/kobo-view?id=${encodeURIComponent(p.id)}" style="background:#0ea5e9;color:white;font-size:11px;padding:5px 10px;border-radius:5px;text-decoration:none;">View submission</a>
              <a target="_blank" href="${dir}" style="background:#16a34a;color:white;font-size:11px;padding:5px 10px;border-radius:5px;text-decoration:none;">🧭 Directions</a>
            </div>
          </div>`;
        m.bindPopup(popup);
        markersRef.current.push({ marker: m, isFlagged: !!p.isFlagged });
      }
      applyFilter(map);
    }).catch((e) => console.error('Leaflet load failed', e));

    return () => { cancelled = true; if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  function applyFilter(map) {
    const m = map || mapRef.current;
    const L = window.L;
    if (!m || !L) return;
    const shown = [];
    for (const { marker, isFlagged } of markersRef.current) {
      const show = filterMode === 'all' || (filterMode === 'flagged' && isFlagged) || (filterMode === 'clean' && !isFlagged);
      if (show) { marker.addTo(m); shown.push(marker); }
      else { m.removeLayer(marker); }
    }
    if (shown.length > 0) {
      try { m.fitBounds(L.featureGroup(shown).getBounds().pad(0.2)); } catch {}
    }
  }

  useEffect(() => { applyFilter(); /* eslint-disable-next-line */ }, [filterMode]);

  useEffect(() => {
    const L = window.L;
    if (!L || !mapRef.current) return;
    if (tileLayerRef.current) mapRef.current.removeLayer(tileLayerRef.current);
    const conf = TILE_LAYERS[layer];
    tileLayerRef.current = L.tileLayer(conf.url, { maxZoom: 19, attribution: conf.attribution }).addTo(mapRef.current);
  }, [layer]);

  return (
    <div className="relative">
      {/* Clean / Flagged filter — top-left, compact */}
      <div className="absolute top-2 left-12 sm:left-14 z-[450] bg-white rounded-lg shadow flex p-0.5 text-[11px] sm:text-xs">
        <FilterBtn active={filterMode === 'all'} onClick={() => setFilterMode('all')}>All ({points.length})</FilterBtn>
        <FilterBtn active={filterMode === 'clean'} onClick={() => setFilterMode('clean')} color="text-sky-700">● Clean ({cleanCount})</FilterBtn>
        <FilterBtn active={filterMode === 'flagged'} onClick={() => setFilterMode('flagged')} color="text-red-700">🚩 ({flaggedCount})</FilterBtn>
      </div>

      {/* Layer switcher — top-right, BELOW the nav (z-450) */}
      <div className="absolute top-2 right-2 z-[450] bg-white rounded-lg shadow flex flex-col p-1 gap-0.5">
        {Object.entries(TILE_LAYERS).map(([k, v]) => (
          <button key={k} onClick={() => setLayer(k)}
            className={`text-[11px] sm:text-xs px-2 py-1 rounded text-left whitespace-nowrap ${layer === k ? 'bg-brand-100 text-brand-900 font-semibold' : 'hover:bg-slate-100'}`}>
            {v.name}
          </button>
        ))}
      </div>

      <div ref={containerRef} style={{ height: '70vh', minHeight: 420, width: '100%' }} />
    </div>
  );
}

function FilterBtn({ active, onClick, children, color = 'text-slate-700' }) {
  return (
    <button onClick={onClick}
      className={`px-2 py-1 rounded whitespace-nowrap ${active ? 'bg-brand-100 font-semibold ' + color : 'hover:bg-slate-100 ' + color}`}>
      {children}
    </button>
  );
}
