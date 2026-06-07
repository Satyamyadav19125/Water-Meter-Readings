'use client';

import { useEffect, useState } from 'react';

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
    if (data.settings) setSettings(data.settings);
    else setError(data.error || 'Failed to load');
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
          <input value={settings.project.name} onChange={(e) => updateProject('name', e.target.value)} className="input"/>
        </Field>
        <Field label="Tagline">
          <input value={settings.project.tagline} onChange={(e) => updateProject('tagline', e.target.value)} className="input"/>
        </Field>
        <Field label="Description (shown on landing)">
          <textarea value={settings.project.description} onChange={(e) => updateProject('description', e.target.value)} rows="3" className="input"/>
        </Field>
        <Field label="Kobo form upload URL (the 'New reading' button)">
          <input value={settings.project.formUploadUrl} onChange={(e) => updateProject('formUploadUrl', e.target.value)} placeholder="https://ee.kobotoolbox.org/x/..." className="input"/>
        </Field>
      </Section>

      {/* Contact */}
      <Section title="📬 Contact info">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Admin email"><input value={settings.contact.adminEmail} onChange={(e) => updateContact('adminEmail', e.target.value)} className="input"/></Field>
          <Field label="Lead researcher email"><input value={settings.contact.leadEmail} onChange={(e) => updateContact('leadEmail', e.target.value)} className="input"/></Field>
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
