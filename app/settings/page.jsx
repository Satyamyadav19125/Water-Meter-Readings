'use client';

import { useEffect, useState } from 'react';
import DataStorage from '@/components/DataStorage';

const FLAG_LABELS = {
  rollback: 'Rollback (reading went backwards)',
  reverse: 'Reverse (end < start within submission)',
  huge_jump: 'Huge jump (>100,000 units)',
  growth_anomaly: 'Growth anomaly (5× normal rate)',
  stale_no_reading: 'Stale (no reading for 10+ days)',
  stale_unchanged: 'Stuck (3 same readings)',
  future_date: 'Future-dated reading',
  out_of_sequence: 'Date earlier than previous reading',
  zero_consumption: 'Zero usage over 7+ days (stuck/bypassed)',
  duplicate_same_day: 'Same meter read twice in one day',
  missing_photo: 'Missing meter photo',
  invalid_meter_id: 'Invalid meter ID format (not WM######)',
  gps_outlier: 'GPS far from meter\'s usual spot',
  digit_count: 'Digit-count jump (likely typo)',
  identical_gps: 'Same GPS used by different meters',
  fabrication_speed: 'Surveyor logged readings impossibly fast (<15s apart)',
  night_reading: 'Reading taken at night (10pm–5am)',
  village_outlier: 'Usage far above village neighbours',
};

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (data.settings) {
      // Defensive: legacy DB documents may be missing newer sub-objects.
      // Fill them with safe defaults so the page never crashes on access.
      setSettings({
        contact: {}, redFlags: {}, project: {}, forms: [],
        reading: {
          target: 2, periodLabel: 'week', periodDays: 7,
          photoMaxPx: 1600, photoQuality: 0.85,
          profilePhotoMaxPx: 600, profilePhotoQuality: 0.88,
        },
        ...data.settings,
        contact: { ...(data.settings.contact || {}) },
        redFlags: { ...(data.settings.redFlags || {}) },
        project: { ...(data.settings.project || {}) },
        forms: Array.isArray(data.settings.forms) ? data.settings.forms : [],
        reading: {
          target: 2, periodLabel: 'week', periodDays: 7,
          photoMaxPx: 1600, photoQuality: 0.85,
          profilePhotoMaxPx: 600, profilePhotoQuality: 0.88,
          ...(data.settings.reading || {}),
        },
      });
    } else {
      setError(data.error || 'Failed to load');
    }
    setLoading(false);
  }

  async function save() {
    setSaving(true);
    setError(null); setMessage(null);
    const res = await fetch('/api/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error || 'Save failed'); return; }
    setMessage('Saved ✓');
    setTimeout(() => setMessage(null), 2500);
  }

  function updateContact(k, v) { setSettings({ ...settings, contact: { ...settings.contact, [k]: v } }); }
  function updateFlag(k, v) { setSettings({ ...settings, redFlags: { ...settings.redFlags, [k]: v } }); }
  function updateProject(k, v) { setSettings({ ...settings, project: { ...settings.project, [k]: v } }); }

  function addForm() {
    const list = [...(settings.forms || [])];
    list.push({
      name: `Form ${list.length + 1}`,
      baseUrl: 'https://kf.kobotoolbox.org',
      assetUid: '',
      token: '',
      isActive: list.length === 0,
    });
    setSettings({ ...settings, forms: list });
  }

  function updateForm(i, k, v) {
    const list = [...settings.forms];
    list[i] = { ...list[i], [k]: v };
    if (k === 'isActive' && v) list.forEach((f, idx) => { if (idx !== i) f.isActive = false; });
    setSettings({ ...settings, forms: list });
  }

  function deleteForm(i) {
    if (!confirm(`Delete form "${settings.forms[i].name}"?`)) return;
    const list = settings.forms.filter((_, idx) => idx !== i);
    setSettings({ ...settings, forms: list });
  }

  if (loading) return <p className="text-slate-500">Loading…</p>;
  if (!settings) return <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">{error || 'Not authorized — admin only'}</div>;

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-xl font-bold">⚙️ Settings</h1>
        <button onClick={save} disabled={saving} className="px-4 py-2 rounded bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:bg-slate-300">
          {saving ? 'Saving…' : 'Save all changes'}
        </button>
      </div>
      {message && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded p-2 text-sm">{message}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-800 rounded p-2 text-sm">{error}</div>}

      {/* Data & storage */}
      <Section title="🗄️ Data & storage" subtitle="MongoDB usage, monthly downloads, and old-data cleanup">
        <DataStorage />
      </Section>

      {/* Reading targets */}
      <Section title="🎯 Reading targets" subtitle="How many readings each meter needs, and how often">
        <ReadingTargets settings={settings} setSettings={setSettings} />
      </Section>

      {/* Photo quality */}
      <Section title="🖼️ Photo quality" subtitle="Larger photos = more HD, but use more database space">
        <PhotoQuality settings={settings} setSettings={setSettings} />
      </Section>

      {/* Kobo forms */}
      <Section title="📋 Kobo forms" subtitle="Switch between seasonal forms (Kharif, Rabi, etc). Mark exactly one as active.">
        <div className="space-y-3">
          {(settings.forms || []).length === 0 && (
            <p className="text-xs text-slate-500 italic">No forms saved yet — using env vars as default. Add a form below to override.</p>
          )}
          {(settings.forms || []).map((form, i) => (
            <div key={i} className={`border rounded-lg p-3 space-y-2 ${form.isActive ? 'border-field-400 bg-field-50/50' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between gap-2">
                <input value={form.name || ''} onChange={(e) => updateForm(i, 'name', e.target.value)} placeholder="Form name (e.g. Kharif 2026)" className="input flex-1 font-medium"/>
                <label className="flex items-center gap-1 text-xs cursor-pointer">
                  <input type="checkbox" checked={!!form.isActive} onChange={(e) => updateForm(i, 'isActive', e.target.checked)}/>
                  Active
                </label>
                <button onClick={() => deleteForm(i)} className="text-red-600 text-sm">🗑️</button>
              </div>
              <input value={form.baseUrl || ''} onChange={(e) => updateForm(i, 'baseUrl', e.target.value)} placeholder="Base URL (e.g. https://kf.kobotoolbox.org)" className="input"/>
              <input value={form.assetUid || ''} onChange={(e) => updateForm(i, 'assetUid', e.target.value)} placeholder="Asset UID" className="input font-mono text-xs"/>
              <input value={form.token || ''} onChange={(e) => updateForm(i, 'token', e.target.value)} placeholder="API token (keep secret)" type="password" className="input font-mono text-xs"/>
            </div>
          ))}
          <button onClick={addForm} className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-brand-500">
            + Add new Kobo form
          </button>
        </div>
      </Section>

      {/* Project info */}
      <Section title="🌱 Project info">
        <Field label="Project name">
          <input value={settings.project.name || ''} onChange={(e) => updateProject('name', e.target.value)} className="input"/>
        </Field>
        <Field label="Tagline">
          <input value={settings.project.tagline || ''} onChange={(e) => updateProject('tagline', e.target.value)} className="input"/>
        </Field>
        <Field label="Description (shown on landing)">
          <textarea value={settings.project.description || ''} onChange={(e) => updateProject('description', e.target.value)} rows="3" className="input"/>
        </Field>
        <Field label="Kobo form upload URL (the 'New reading' button)">
          <input value={settings.project.formUploadUrl || ''} onChange={(e) => updateProject('formUploadUrl', e.target.value)} placeholder="https://ee.kobotoolbox.org/x/..." className="input"/>
        </Field>
      </Section>

      {/* Contact */}
      <Section title="📬 Contact info">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Admin email"><input value={settings.contact.adminEmail || ''} onChange={(e) => updateContact('adminEmail', e.target.value)} className="input"/></Field>
          <Field label="Lead researcher email"><input value={settings.contact.leadEmail || ''} onChange={(e) => updateContact('leadEmail', e.target.value)} className="input"/></Field>
          <Field label="Admin phone"><input value={settings.contact.adminPhone || ''} onChange={(e) => updateContact('adminPhone', e.target.value)} className="input"/></Field>
          <Field label="Admin WhatsApp (with country code, e.g. +919876543210)"><input value={settings.contact.adminWhatsapp || ''} onChange={(e) => updateContact('adminWhatsapp', e.target.value)} placeholder="+91…" className="input"/></Field>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <Toggle label="Show emails" checked={settings.contact.showEmails} onChange={(v) => updateContact('showEmails', v)}/>
          <Toggle label="Show phone" checked={settings.contact.showPhone} onChange={(v) => updateContact('showPhone', v)}/>
          <Toggle label="Show on landing page" checked={settings.contact.showOnLanding} onChange={(v) => updateContact('showOnLanding', v)}/>
          <Toggle label="Show in footer" checked={settings.contact.showInFooter} onChange={(v) => updateContact('showInFooter', v)}/>
        </div>
      </Section>

      {/* Red flags */}
      <Section title="🚩 Red flag rules" subtitle="Toggle which checks should fire">
        <div className="space-y-2">
          {Object.entries(FLAG_LABELS).map(([k, label]) => (
            <Toggle key={k} label={label} checked={settings.redFlags[k] !== false} onChange={(v) => updateFlag(k, v)}/>
          ))}
        </div>
      </Section>

      <style jsx>{`
        :global(.input) {
          width: 100%; padding: 0.5rem 0.625rem; border: 1px solid #cbd5e1;
          border-radius: 0.5rem; font-size: 0.875rem; background: white;
        }
        :global(.input:focus) { outline: 2px solid #0ea5e9; outline-offset: -1px; }
      `}</style>
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5">
      <div className="mb-3">
        <h2 className="font-semibold text-base">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 p-2 rounded hover:bg-slate-50 cursor-pointer text-sm">
      <span>{label}</span>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4"/>
    </label>
  );
}

const PERIOD_PRESETS = [
  { label: 'Week (7 days)', periodDays: 7, periodLabel: 'week' },
  { label: '10 days',       periodDays: 10, periodLabel: '10-day' },
  { label: 'Month (30 days)', periodDays: 30, periodLabel: 'month' },
  { label: 'Custom…',       periodDays: -1, periodLabel: 'period' },
];

function ReadingTargets({ settings, setSettings }) {
  const r = settings.reading || {};
  const isCustom = ![7, 10, 30].includes(Number(r.periodDays) || 7);
  function set(k, v) { setSettings({ ...settings, reading: { ...r, [k]: v } }); }
  function pickPreset(p) {
    if (p.periodDays === -1) { set('periodDays', Math.max(1, Number(r.periodDays) || 14)); set('periodLabel', 'period'); return; }
    setSettings({ ...settings, reading: { ...r, periodDays: p.periodDays, periodLabel: p.periodLabel } });
  }
  const example = (Number(r.target) || 2) === 1
    ? `Each meter needs 1 reading every ${r.periodLabel || 'week'} (${r.periodDays || 7} days).`
    : `Each meter needs ${r.target || 2} readings every ${r.periodLabel || 'week'} (${r.periodDays || 7} days).`;

  return (
    <div className="space-y-3">
      <Field label="How many readings per period?">
        <div className="flex items-center gap-2 flex-wrap">
          <input type="number" min="1" max="50" value={r.target ?? 2}
            onChange={(e) => set('target', Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
            className="input w-24 tabular-nums" />
          <span className="text-sm text-slate-600">reading{(r.target || 2) === 1 ? '' : 's'} per meter</span>
        </div>
      </Field>

      <Field label="How long is one period?">
        <div className="flex gap-1.5 flex-wrap">
          {PERIOD_PRESETS.map((p) => {
            const active = p.periodDays === -1 ? isCustom : Number(r.periodDays) === p.periodDays;
            return (
              <button key={p.label} type="button" onClick={() => pickPreset(p)}
                className={`px-3 py-1.5 rounded-full text-sm border transition ${active ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'}`}>
                {p.label}
              </button>
            );
          })}
        </div>
      </Field>

      {isCustom && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Days in one period">
            <input type="number" min="1" max="365" value={r.periodDays ?? 7}
              onChange={(e) => set('periodDays', Math.max(1, Math.min(365, Number(e.target.value) || 1)))}
              className="input tabular-nums" />
          </Field>
          <Field label="Period name (what the dashboard calls it)">
            <input value={r.periodLabel || 'period'} onChange={(e) => set('periodLabel', e.target.value.slice(0, 20))} placeholder="period" className="input" />
          </Field>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-900">
        <b>Effect:</b> {example} The Overview, Assignments, Team and Missed Readings pages all use this target to decide when a meter is "Done".
      </div>
    </div>
  );
}

function PhotoQuality({ settings, setSettings }) {
  const r = settings.reading || {};
  function set(k, v) { setSettings({ ...settings, reading: { ...r, [k]: v } }); }
  const meterKB = Math.round(((r.photoMaxPx || 1600) ** 2 * (r.photoQuality || 0.85) * 0.18) / 1024);
  const profileKB = Math.round(((r.profilePhotoMaxPx || 600) ** 2 * (r.profilePhotoQuality || 0.88) * 0.18) / 1024);
  return (
    <div className="space-y-3">
      <Field label="Meter photo — max width/height (pixels)">
        <input type="range" min="400" max="3000" step="100" value={r.photoMaxPx || 1600}
          onChange={(e) => set('photoMaxPx', Number(e.target.value))} className="w-full" />
        <div className="text-xs text-slate-600 mt-1">{r.photoMaxPx || 1600} px · about {Math.max(20, meterKB)} KB per photo</div>
      </Field>
      <Field label="Meter photo — JPEG quality">
        <input type="range" min="0.4" max="0.98" step="0.02" value={r.photoQuality || 0.85}
          onChange={(e) => set('photoQuality', Number(e.target.value))} className="w-full" />
        <div className="text-xs text-slate-600 mt-1">{Math.round((r.photoQuality || 0.85) * 100)}% quality</div>
      </Field>
      <div className="border-t border-slate-100 pt-3">
        <Field label="Profile photo — max width/height (pixels)">
          <input type="range" min="200" max="1200" step="50" value={r.profilePhotoMaxPx || 600}
            onChange={(e) => set('profilePhotoMaxPx', Number(e.target.value))} className="w-full" />
          <div className="text-xs text-slate-600 mt-1">{r.profilePhotoMaxPx || 600} px · about {Math.max(8, profileKB)} KB per photo</div>
        </Field>
      </div>
      <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm text-amber-900">
        <b>Database budget:</b> the free MongoDB tier is 512 MB total. At 1600 px the meter photos are sharp and zoom-friendly; at 2400 px they're near-original phone quality. Profile photos are small so 600 px is plenty.
      </div>
    </div>
  );
}
