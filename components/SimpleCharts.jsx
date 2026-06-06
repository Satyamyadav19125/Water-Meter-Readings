'use client';

import { useEffect, useRef } from 'react';

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

function escapeHtml(s) {
  return String(s ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default function MapView({ points = [] }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    function loadCss() {
      if (document.getElementById('leaflet-css')) return;
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }

    function loadJs() {
      return new Promise((resolve, reject) => {
        if (window.L) return resolve(window.L);
        const existing = document.getElementById('leaflet-js');
        if (existing) {
          existing.addEventListener('load', () => resolve(window.L));
          existing.addEventListener('error', reject);
          return;
        }
        const script = document.createElement('script');
        script.id = 'leaflet-js';
        script.src = LEAFLET_JS;
        script.async = true;
        script.onload = () => resolve(window.L);
        script.onerror = reject;
        document.body.appendChild(script);
      });
    }

    loadCss();
    loadJs().then((L) => {
      if (cancelled || !containerRef.current) return;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      const map = L.map(containerRef.current).setView([30.9, 75.8], 9);
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      const markers = [];
      for (const p of points) {
        const m = L.marker([p.lat, p.lng]);
        const popup = `
          <div style="min-width: 200px; font-family: system-ui, sans-serif;">
            <div style="font-weight: 600; color: #0c4a6e; margin-bottom: 4px;">📍 ${escapeHtml(p.village)}</div>
            <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">
              ${new Date(p.time).toLocaleString()}
            </div>
            <table style="width: 100%; font-size: 12px;">
              <tr><td style="color: #64748b; padding: 1px 0;">Meter</td><td style="font-family: monospace;">${escapeHtml(p.serial)}</td></tr>
              <tr><td style="color: #64748b; padding: 1px 0;">Reading</td><td style="font-weight: 600;">${escapeHtml(p.reading)}</td></tr>
              <tr><td style="color: #64748b; padding: 1px 0;">Surveyor</td><td>${escapeHtml(p.surveyor)}</td></tr>
            </table>
            <div style="margin-top: 6px;">
              <a href="/kobo-view?id=${encodeURIComponent(p.id)}" style="color: #0284c7; font-size: 12px; text-decoration: none;">View full submission →</a>
            </div>
          </div>
        `;
        m.bindPopup(popup);
        m.addTo(map);
        markers.push(m);
      }

      if (markers.length > 0) {
        const group = L.featureGroup(markers);
        try { map.fitBounds(group.getBounds().pad(0.2)); } catch {}
      }
    }).catch((e) => {
      console.error('Leaflet load failed', e);
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [points]);

  return <div ref={containerRef} style={{ height: '70vh', minHeight: 420, width: '100%' }} />;
}
