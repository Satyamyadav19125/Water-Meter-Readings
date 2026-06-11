'use client';

import { useState, useRef } from 'react';
import Lightbox from '@/components/Lightbox';

// Resizes an image file to max 400px, ~JPEG 0.8, returns a data URL.
function resizeImage(file, maxDim = 400, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; }
        else if (height > maxDim) { width = Math.round((width * maxDim) / height); height = maxDim; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function PhotoUpload({ value, onChange, label = 'Photo' }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [view, setView] = useState(false);
  const fileRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null); setBusy(true);
    try {
      const dataUrl = await resizeImage(file);
      const res = await fetch('/api/media', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      onChange(data.url);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div>
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      <div className="flex items-center gap-3">
        {value ? (
          <button type="button" onClick={() => setView(true)} title="
