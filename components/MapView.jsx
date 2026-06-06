'use client';

import { useEffect, useRef, useState } from 'react';

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

const TILE_LAYERS = {
  street: { name: '🗺️ Street', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap contributors' },
  satellite: { name: '🛰️ Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles © Esri' },
  topo: { name: '⛰️ Topographic', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attribution: '© OpenTopoMap' },
};

function escapeHtml(s) {
  return String(s ?? '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export default function MapView({ points = [] }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const [layer, setLayer] = useState('street');

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
      const map = L.map(containerRef.current).setView([30.9, 75.8], 9);
      mapRef.current = map;
      const conf = TILE_LAYERS[layer];
      tileLayerRef.current = L.tileLayer(conf.url, { maxZoom: 19, attribution: conf.attribution }).addTo(map);

      const markers = [];
      for (const p of points) {
        const m = L.marker([p.lat, p.lng]);
        const gmaps = `https://www.google.com/maps?q=${p.lat},${p.lng}`;
        const gmapsDirections = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
        const popup = `
          <div style="min-width: 220px; font-family: system-ui, sans-serif;">
            <div style="font-weight: 600; color: #0c4a6e; margin-bottom: 4px;">
              <span>📍</span><span>${escapeHtml(p.village)}</span>
            </div>
            <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">${new Date(p.time).toLocaleString()}</div>
            <table style="width: 100%; font-size: 12px;">
              <tr><td style="color: #64748b; padding: 1px 0;">Meter</td><td style="font-family: monospace;">${escapeHtml(p.serial)}</td></tr>
              <tr><td style="color: #64748b; padding: 1px 0;">Reading</td><td style="font-weight: 600;">${escapeHtml(p.reading)}</td></tr>
              <tr><td style="color: #64748b; padding: 1px 0;">Surveyor</td><td>${escapeHtml(p.surveyor)}</td></tr>
            </table>
            <div style="margin-top: 8px; display:flex; gap:6px; flex-wrap:wrap;">
              <a target="_blank" href="/kobo-view?id=${encodeURIComponent(p.id)}" style="background:#0ea5e9;color:white;font-size:11px;padding:4px 8px;border-radius:4px;text-decoration:none;">View submission</a>
              <a target="_blank" href="${gmaps}" style="background:#22c55e;color:white;font-size:11px;padding:4px 8px;border-radius:4px;text-decoration:none;">🌍 Google Maps</a>
              <a target="_blank" href="${gmapsDirections}" style="background:#16a34a;color:white;font-size:11px;padding:4px 8px;border-radius:4px;text-decoration:none;">🧭 Directions</a>
            </div>
          </div>`;
        m.bindPopup(popup);
        m.addTo(map);
        markers.push(m);
      }
      if (markers.length > 0) {
        const group = L.featureGroup(markers);
        try { map.fitBounds(group.getBounds().pad(0.2)); } catch {}
      }
    }).catch((e) => console.error('Leaflet load failed', e));
    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, [points]);

  useEffect(() => {
    const L = window.L;
    if (!L || !mapRef.current) return;
    if (tileLayerRef.current) mapRef.current.removeLayer(tileLayerRef.current);
    const conf = TILE_LAYERS[layer];
    tileLayerRef.current = L.tileLayer(conf.url, { maxZoom: 19, attribution: conf.attribution }).addTo(mapRef.current);
  }, [layer]);

  return (
    <div className="relative">
      <div ref={containerRef} style={{ height: '70vh', minHeight: 420, width: '100%' }} />
      <div className="absolute top-3 right-3 z-[400] bg-white rounded-lg shadow flex flex-col p-1 gap-0.5">
        {Object.entries(TILE_LAYERS).map(([k, v]) => (
          <button key={k} onClick={() => setLayer(k)} className={`text-xs px-2.5 py-1.5 rounded text-left whitespace-nowrap ${layer === k ? 'bg-brand-100 text-brand-900 font-semibold' : 'hover:bg-slate-100'}`}>
            {v.name}
          </button>
        ))}
      </div>
    </div>
  );
}
