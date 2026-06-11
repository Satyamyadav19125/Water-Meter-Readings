'use client';

import { useState, useRef } from 'react';

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
          <img src={value} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-brand-200" onError={(e) => { e.target.style.display = 'none'; }} />
        ) : (
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-100 to-field-100 flex items-center justify-center text-xl">👤</div>
        )}
        <div className="flex flex-col gap-1">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
            className="px-3 py-1.5 text-xs bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:bg-slate-300">
            {busy ? 'Uploading…' : value ? 'Change photo' : '📷 Upload photo'}
          </button>
          {value && (
            <button type="button" onClick={() => onChange('')} className="px-3 py-1.5 text-xs text-red-600 hover:underline text-left">Remove</button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      </div>
      {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
      <p className="text-[10px] text-slate-400 mt-1">Stored securely in the project database. Auto-resized to keep it small.</p>
    </div>
  );
}
