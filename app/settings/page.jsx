'use client';

import { useEffect, useState, useRef } from 'react';
import { APP_LEVEL } from '@/lib/version';
import DataStorage from '@/components/DataStorage';

const FLAG_LABELS = {
  // ON by default for meters — a cumulative meter cannot go backwards.
  rollback: 'Rollback — reading went backwards (a meter cannot decrease)',
  reverse: 'End reading lower than start reading (within one submission)',
  huge_jump: 'Huge jump between two readings (likely an extra digit)',
  growth_anomaly: 'Usage rose far faster than usual for this meter',
  stale_no_reading: 'Stale — no reading taken for 10+ days',
  stale_unchanged: 'Stuck — 3 identical readings in a row',
  future_date: 'Future-dated reading',
  out_of_sequence: 'Reading date earlier than the previous one',
  location_far: 'GPS far outside the whole project area (swapped / mistyped lat-long)',
  // Opt-in extras (off by default)
  missing_photo: 'Missing meter photo on a submission',
  invalid_meter_id: 'Meter ID not in the expected WM###### format',
  zero_consumption: 'No usage over 7+ days (reading stayed flat)',
  gps_outlier: "GPS far from this meter's usual spot",
  digit_count: 'Digit-count jump in the reading (likely typo)',
  duplicate_same_day: 'Duplicate — same meter read twice in one day',
  identical_gps: 'Same GPS used by different meters',
  fabrication_speed: 'Readings logged impossibly fast (<15s apart)',
  night_reading: 'Reading taken at night (10pm–5am)',
  village_outlier: 'Usage far above other meters in the same village',
};

// All sections, in the order shown on the page.
const SECTIONS = [
  { id: 'forms',    icon: '📋', label: 'Kobo forms',      hint: 'Switch seasons' },
  { id: 'project',  icon: '🌱', label: 'Project info',    hint: 'Name & description' },
  { id: 'reading',  icon: '🎯', label: 'Reading targets', hint: 'Count & period' },
  { id: 'meter',    icon: '📏', label: 'Meter parameters', hint: 'GPS & flag window' },
  { id: 'registry', icon: '🎚️', label: 'Farms & meters',  hint: 'Turn on/off' },
  { id: 'security', icon: '🔐', label: 'Admin passwords', hint: 'Change admin login' },
  { id: 'guest',    icon: '👁️', label: 'Guest & landing', hint: 'Viewer link & landing pages' },
  { id: 'photo',    icon: '🖼️', label: 'Photo quality',  hint: 'HD vs space' },
  { id: 'contact',  icon: '📬', label: 'Contact info',    hint: 'Emails & phone' },
  { id: 'flags',    icon: '🚩', label: 'Red flag rules',  hint: 'What to detect' },
  { id: 'storage',  icon: '🗄️', label: 'Data & storage', hint: 'DB usage' },
];

const METER_DEFAULTS = { maxLocationKm: 100, flagWindowDays: '', hugeJumpThreshold: 100000 };

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [flagSearch, setFlagSearch] = useState('');
  const [activeForm, setActiveForm] = useState(null);
  const [adminInfo, setAdminInfo] = useState(null);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [origin, setOrigin] = useState('');
  const dirtyRef = useRef(false);

  useEffect(() => { load(); }, []);
  useEffect(() => { if (typeof window !== 'undefined') setOrigin(window.location.origin); }, []);

  // Warn before closing the tab if there are unsaved changes
  useEffect(() => {
    function beforeUnload(e) {
      if (dirtyRef.current) { e.preventDefault(); e.returnValue = ''; }
    }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);

  function setS(updater) {
    setDirty(true);
    dirtyRef.current = true;
    setSettings((prev) => typeof updater === 'function' ? updater(prev) : updater);
  }

  async function load() {
    setLoading(true);
    let data = {};
    try {
      const res = await fetch('/api/settings');
      data = await res.json();
      if (!res.ok) throw new Error(data.error || `Settings failed to load (HTTP ${res.status})`);
    } catch (e) {
      setError(e.message);
      setLoading(false);
      return;
    }
    if (data.settings) {
      // Defensive: legacy DB documents may be missing newer sub-objects.
      setSettings({
        contact: {}, redFlags: {}, project: {}, forms: [],
        meter: { ...METER_DEFAULTS },
        security: { adminPasswords: [] },
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
        meter: { ...METER_DEFAULTS, ...(data.settings.meter || {}) },
        security: {
          adminPasswords: (data.settings.security?.adminPasswords?.length
            ? data.settings.security.adminPasswords
            : (data.adminInfo?.passwords || [])),
        },
        reading: {
          target: 2, periodLabel: 'week', periodDays: 7,
          photoMaxPx: 1600, photoQuality: 0.85,
          profilePhotoMaxPx: 600, profilePhotoQuality: 0.88,
          ...(data.settings.reading || {}),
        },
      });
      setActiveForm(data.activeForm || null);
      setAdminInfo(data.adminInfo || null);
      setDirty(false);
      dirtyRef.current = false;
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
    setLastSavedAt(new Date());
    setDirty(false);
    dirtyRef.current = false;
    setTimeout(() => setMessage(null), 2500);
  }

  function updateContact(k, v) { setS({ ...settings, contact: { ...settings.contact, [k]: v } }); }
  function updateFlag(k, v) { setS({ ...settings, redFlags: { ...settings.redFlags, [k]: v } }); }
  function updateMeter(k, v) { setS({ ...settings, meter: { ...(settings.meter || {}), [k]: v } }); }
  function updateSecurity(list) { setS({ ...settings, security: { ...(settings.security || {}), adminPasswords: list } }); }
  function updateProject(k, v) { setS({ ...settings, project: { ...settings.project, [k]: v } }); }
  function updateGuest(k, v) { setS({ ...settings, guest: { ...(settings.guest || {}), [k]: v } }); }
  function updateGuestShow(k, v) { setS({ ...settings, guest: { ...(settings.guest || {}), show: { ...((settings.guest || {}).show || {}), [k]: v } } }); }
  function updateGuestLanding(k, v) { setS({ ...settings, guest: { ...(settings.guest || {}), landing: { ...((settings.guest || {}).landing || {}), [k]: v } } }); }
  function updateLandingControls(k, v) { setS({ ...settings, landingControls: { ...(settings.landingControls || {}), [k]: v } }); }

  function addForm() {
    const list = [...(settings.forms || [])];
    list.push({
      name: `Form ${list.length + 1}`,
      baseUrl: 'https://kf.kobotoolbox.org',
      assetUid: '',
      token: '',
      isActive: list.length === 0,
    });
    setS({ ...settings, forms: list });
  }

  function updateForm(i, k, v) {
    const list = [...settings.forms];
    list[i] = { ...list[i], [k]: v };
    if (k === 'isActive' && v) list.forEach((f, idx) => { if (idx !== i) f.isActive = false; });
    setS({ ...settings, forms: list });
  }

  function deleteForm(i) {
    if (!confirm(`Delete form "${settings.forms[i].name}"?`)) return;
    const list = settings.forms.filter((_, idx) => idx !== i);
    setS({ ...settings, forms: list });
  }

  function jumpTo(id) {
    const el = document.getElementById(`section-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (loading) return <p className="text-slate-500">Loading…</p>;
  if (!settings) return <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">{error || 'Not authorized — admin only'}</div>;

  const filteredFlagKeys = Object.entries(FLAG_LABELS).filter(([k, label]) => {
    const q = flagSearch.trim().toLowerCase();
    if (!q) return true;
    return k.includes(q) || label.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Sticky title + save bar — always visible while scrolling */}
      <div className="sticky top-[60px] z-40 -mx-3 sm:mx-0 bg-slate-100/95 backdrop-blur px-3 sm:px-0 py-2 border-b border-slate-200">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h1 className="text-xl font-bold">⚙️ Settings <span className="text-xs font-normal text-slate-400 align-middle">Level {APP_LEVEL}</span></h1>
            {lastSavedAt && !dirty && (
              <p className="text-[11px] text-slate-500">Last saved {lastSavedAt.toLocaleTimeString()}</p>
            )}
            {dirty && (
              <p className="text-[11px] text-amber-700 font-medium">● You have unsaved changes</p>
            )}
          </div>
          <button onClick={save} disabled={saving || !dirty}
            className={`px-4 py-2 rounded text-sm font-medium transition ${
              !dirty ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
              : 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm'}`}>
            {saving ? 'Saving…' : dirty ? '💾 Save changes' : 'Saved'}
          </button>
        </div>
        {message && <div className="mt-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded p-1.5 text-xs">{message}</div>}
        {error && <div className="mt-1.5 bg-red-50 border border-red-200 text-red-800 rounded p-1.5 text-xs">{error}</div>}
      </div>

      {/* Jump-to nav — tap any section to scroll there instantly */}
      <div className="bg-white rounded-xl shadow-sm p-2 flex flex-wrap gap-1.5">
        {SECTIONS.map((s) => (
          <button key={s.id} onClick={() => jumpTo(s.id)}
            className="text-xs px-2.5 py-1.5 rounded-full border border-slate-200 hover:border-brand-400 hover:bg-brand-50 transition text-slate-700 inline-flex items-center gap-1"
            title={s.hint}>
            <span>{s.icon}</span><span>{s.label}</span>
          </button>
        ))}
      </div>

      {/* Kobo forms — moved to top: the most important admin action */}
      <Section id="forms" title="📋 Kobo forms" subtitle="Switch between seasonal forms (Kharif, Rabi, etc). Mark exactly one as active.">
        <div className="space-y-3">
          {activeForm && (
            <div className="bg-brand-50 border border-brand-200 rounded-lg p-2.5 text-xs space-y-0.5">
              <div className="font-semibold text-brand-900">🔗 Currently active form</div>
              <div className="text-slate-600">Name: <b>{activeForm.name}</b></div>
              <div className="text-slate-600">Server: <span className="font-mono">{activeForm.baseUrl}</span></div>
              <div className="text-slate-600">Unique ID (asset UID): <span className="font-mono select-all bg-white/70 px-1 rounded border border-brand-100">{activeForm.assetUid || '—'}</span></div>
            </div>
          )}
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
      <Section id="project" title="🌱 Project info">
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
        <div className="bg-sky-50 border border-sky-100 rounded-lg p-2.5 text-xs text-sky-900">
          <b>➕ New reading button:</b> when this URL is set, the top bar shows a <b>New reading</b> button that opens this Kobo form for the surveyor. Use the <b>web form (Enketo) URL</b> — in KoboToolbox open the form → <b>Collect data</b> → copy the <b>"Online-Offline (multiple submission)"</b> link (it looks like <span className="font-mono">ee.kobotoolbox.org/x/…</span>).
        </div>
      </Section>

      {/* Reading targets */}
      <Section id="reading" title="🎯 Reading targets" subtitle="How many readings each meter needs, and how often">
        <ReadingTargets settings={settings} setSettings={setS} />
      </Section>

      {/* Meter parameters — GPS sanity + red-flag review window */}
      <Section id="meter" title="📏 Meter parameters"
        subtitle="Fine-tune a couple of the data-quality checks. Clear a box to disable that check.">
        <div className="border border-rose-200 bg-rose-50/40 rounded-lg p-3 space-y-2">
          <div className="text-xs font-semibold text-slate-700">📍 GPS sanity check</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Max distance from project centre (km)">
              <input type="number" min="1" value={settings.meter?.maxLocationKm ?? ''} placeholder="100"
                onChange={(e) => updateMeter('maxLocationKm', e.target.value === '' ? '' : Number(e.target.value))} className="input"/>
            </Field>
          </div>
          <p className="text-[11px] text-slate-500">Any reading whose GPS is farther than this from the centre of <i>all</i> readings raises <i>GPS far outside the whole project area</i> — this catches a swapped or mistyped latitude/longitude (e.g. a meter that lands hundreds of km away). Requires the <b>🚩 Red flag rules</b> toggle of the same name to be on. Clear the box to disable.</p>
        </div>
        <div className="border border-amber-200 bg-amber-50/40 rounded-lg p-3 space-y-2">
          <div className="text-xs font-semibold text-slate-700">🗓️ Red-flag review window</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Only red-flag readings from the last N days">
              <input type="number" min="1" value={settings.meter?.flagWindowDays ?? ''} placeholder="e.g. 20 (blank = all)"
                onChange={(e) => updateMeter('flagWindowDays', e.target.value === '' ? '' : Number(e.target.value))} className="input"/>
            </Field>
          </div>
          <p className="text-[11px] text-slate-500">Old readings that haven't been touched in a while stop showing as red flags — set this to (say) 20 so only recent readings are flagged. Leave blank to flag every reading regardless of age. Older readings still count as history for comparisons; they just don't clutter the flag list.</p>
        </div>
        <div className="border border-slate-200 rounded-lg p-3 space-y-2">
          <div className="text-xs font-semibold text-slate-700">🔢 Huge-jump threshold</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Flag a jump bigger than (units)">
              <input type="number" min="1" value={settings.meter?.hugeJumpThreshold ?? ''} placeholder="100000"
                onChange={(e) => updateMeter('hugeJumpThreshold', e.target.value === '' ? '' : Number(e.target.value))} className="input"/>
            </Field>
          </div>
          <p className="text-[11px] text-slate-500">A rise bigger than this between two readings raises the <i>Huge jump</i> flag (usually an extra digit typed by mistake). Keep it well above normal usage so genuine consumption never trips it.</p>
        </div>
      </Section>

      {/* Farms & meters on/off registry */}
      <Section id="registry" title="🎚️ Turn farms & meters on/off"
        subtitle="Disabled farms and meters disappear from the surveyor's view, are never counted as missed, and never raise red flags.">
        <RegistryPanel />
      </Section>

      {/* Admin passwords — change admin login without touching Vercel */}
      <Section id="security" title="🔐 Admin passwords"
        subtitle="Passwords that log someone in as an ADMIN. Surveyor passwords are managed per person in Assignment → Team.">
        {adminInfo && (
          <div className="bg-brand-50 border border-brand-200 rounded-lg p-2.5 text-xs mb-2">
            <b>{adminInfo.count} admin{adminInfo.count === 1 ? '' : 's'}</b> configured
            {adminInfo.source === 'env' ? ' (from the ADMIN_PASSWORD env var — edit below and Save to manage them here instead)' : ' (managed here)'}.
            {' '}Logged in as: <b>{adminInfo.names[adminInfo.youIndex] || 'Admin'}</b>
          </div>
        )}
        <div className="space-y-2">
          {(settings.security?.adminPasswords || []).map((pw, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-slate-500 w-24 truncate">
                {(adminInfo?.names?.[i]) || `Admin ${i + 1}`}{adminInfo?.youIndex === i ? ' (you)' : ''}
              </span>
              <input value={pw} onChange={(e) => updateSecurity((settings.security?.adminPasswords || []).map((x, j) => j === i ? e.target.value : x))}
                placeholder="At least 4 characters" className="input flex-1 font-mono"/>
              <button onClick={() => updateSecurity((settings.security?.adminPasswords || []).filter((_, j) => j !== i))} className="text-red-600 text-sm px-1">🗑️</button>
            </div>
          ))}
          <button onClick={() => updateSecurity([...(settings.security?.adminPasswords || []), ''])}
            className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-brand-500 text-sm">
            + Add admin password
          </button>
        </div>
        <div className="text-xs text-slate-500 space-y-1 mt-2">
          <p>• If this list has at least one password, it <b>replaces</b> the <span className="font-mono">ADMIN_PASSWORD</span> env var on Vercel. Leave it empty to keep using the env var.</p>
          <p>• Each password = one admin (Admin 1, Admin 2…), matching the profile order in <span className="font-mono">adminProfiles</span>.</p>
          <p>• ⚠️ After saving a change to your own password you will be logged out — log back in with the new one. Passwords shorter than 4 characters are ignored.</p>
        </div>
      </Section>

      {/* Guest viewer + landing page control */}
      <Section id="guest" title="👁️ Guest viewer & landing pages"
        subtitle="A read-only link you can share so people can explore the tool safely, plus full control of both landing pages.">
        <GuestPanel settings={settings} origin={origin}
          updateGuest={updateGuest} updateGuestShow={updateGuestShow}
          updateGuestLanding={updateGuestLanding} updateLandingControls={updateLandingControls} />
      </Section>

      {/* Photo quality */}
      <Section id="photo" title="🖼️ Photo quality" subtitle="Larger photos = more HD, but use more database space">
        <PhotoQuality settings={settings} setSettings={setS} />
      </Section>

      {/* Contact */}
      <Section id="contact" title="📬 Contact info">
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

        {/* People shown on the landing page — each with a designation */}
        <div className="mt-4 border-t border-slate-100 pt-3">
          <div className="text-sm font-medium text-slate-700 mb-1">👥 People on the landing page</div>
          <p className="text-xs text-slate-500 mb-2">Add as many people as you want — name, designation, and contact details. They appear in "Get in touch" on the landing page in this order. If this list is empty, the two email/phone fields above are shown instead.</p>
          <div className="space-y-2">
            {(settings.contact.people || []).map((person, i) => (
              <div key={i} className="border border-slate-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-500">Person {i + 1}</span>
                  <button onClick={() => updateContact('people', (settings.contact.people || []).filter((_, j) => j !== i))} className="text-red-600 text-sm">🗑️</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input value={person.name || ''} onChange={(e) => updateContact('people', (settings.contact.people || []).map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Name (e.g. Satyam Yadav)" className="input"/>
                  <input value={person.designation || ''} onChange={(e) => updateContact('people', (settings.contact.people || []).map((x, j) => j === i ? { ...x, designation: e.target.value } : x))} placeholder="Designation (e.g. Lead Research Assistant)" className="input"/>
                  <input value={person.phone || ''} onChange={(e) => updateContact('people', (settings.contact.people || []).map((x, j) => j === i ? { ...x, phone: e.target.value } : x))} placeholder="Phone (optional)" className="input"/>
                  <input value={person.email || ''} onChange={(e) => updateContact('people', (settings.contact.people || []).map((x, j) => j === i ? { ...x, email: e.target.value } : x))} placeholder="Email (optional)" className="input"/>
                  <input value={person.whatsapp || ''} onChange={(e) => updateContact('people', (settings.contact.people || []).map((x, j) => j === i ? { ...x, whatsapp: e.target.value } : x))} placeholder="WhatsApp with country code (optional)" className="input sm:col-span-2"/>
                </div>
              </div>
            ))}
            <button onClick={() => updateContact('people', [...(settings.contact.people || []), { name: '', designation: '', phone: '', email: '', whatsapp: '' }])}
              className="w-full py-2.5 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-brand-500 text-sm">
              + Add person
            </button>
          </div>
        </div>
      </Section>

      {/* Red flags */}
      <Section id="flags" title="🚩 Red flag rules" subtitle="Toggle which checks should fire">
        <input value={flagSearch} onChange={(e) => setFlagSearch(e.target.value)} placeholder="🔎 Search flag rules…"
          className="input mb-2" />
        <div className="space-y-1">
          {filteredFlagKeys.length === 0 ? (
            <p className="text-xs text-slate-400 italic px-1 py-2">No flag rules match "{flagSearch}".</p>
          ) : filteredFlagKeys.map(([k, label]) => (
            <Toggle key={k} label={label} checked={settings.redFlags[k] !== false} onChange={(v) => updateFlag(k, v)}/>
          ))}
        </div>
      </Section>

      {/* Data & storage — at the bottom (heaviest section, least frequently used) */}
      <Section id="storage" title="🗄️ Data & storage" subtitle="MongoDB usage, monthly downloads, and old-data cleanup">
        <DataStorage />
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

function Section({ id, title, subtitle, children }) {
  return (
    <div id={`section-${id}`} className="bg-white rounded-xl shadow-sm p-4 sm:p-5 scroll-mt-32">
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

// ---- Guest viewer + landing page controls ----
const GUEST_SECTIONS = [
  ['overview', 'Overview'], ['submissions', 'Submissions'], ['map', 'Map'],
  ['usage', 'Water usage'], ['assignment', 'Assignment / readings'], ['team', 'Team (demo)'],
  ['chat', 'Chat (read-only)'], ['redFlags', 'Red-flag info'], ['charts', 'Charts'],
];
function GuestPanel({ settings, origin, updateGuest, updateGuestShow, updateGuestLanding, updateLandingControls }) {
  const g = settings.guest || {};
  const show = g.show || {};
  const gl = g.landing || {};
  const lc = settings.landingControls || {};
  const [copied, setCopied] = useState(false);
  const link = `${origin || ''}/view`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };
  return (
    <div className="space-y-4">
      <Toggle label="Enable the guest viewer link" checked={g.enabled === true} onChange={(v) => updateGuest('enabled', v)} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Guest password (you choose it)">
          <input value={g.password || ''} onChange={(e) => updateGuest('password', e.target.value)} placeholder="e.g. show2026" className="input font-mono"/>
        </Field>
        <Field label="Max readings a guest can see">
          <input type="number" min="1" max="200" value={g.maxReadings ?? 10} onChange={(e) => updateGuest('maxReadings', Math.max(1, Number(e.target.value) || 10))} className="input"/>
        </Field>
      </div>
      <Field label="App name shown to guests (top bar & browser tab)">
        <input value={g.appName || ''} onChange={(e) => updateGuest('appName', e.target.value)} placeholder="e.g. Water Monitoring — leave blank for “Field Readings”" className="input"/>
      </Field>

      {/* Shareable link */}
      <div className="bg-brand-50 border border-brand-200 rounded-lg p-3 space-y-1.5">
        <div className="text-xs font-semibold text-brand-900">🔗 Shareable viewer link</div>
        <div className="flex items-center gap-2 flex-wrap">
          <code className="font-mono text-xs bg-white px-2 py-1 rounded border border-brand-100 break-all flex-1 min-w-[180px]">{link || '…'}</code>
          <button onClick={copy} className="text-xs px-3 py-1.5 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700">{copied ? '✓ Copied' : 'Copy link'}</button>
        </div>
        <p className="text-[11px] text-slate-600">Send this link + the guest password to anyone you want to show the tool. They see a read-only demo — they can't edit, download, open Kobo, or see more than {g.maxReadings ?? 10} readings. <b>Save your changes first</b> for the link to work.</p>
      </div>

      {/* What a guest can open */}
      <div className="border border-slate-200 rounded-lg p-3">
        <div className="text-xs font-semibold text-slate-700 mb-1.5">What the guest can open</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          {GUEST_SECTIONS.map(([k, label]) => (
            <Toggle key={k} label={label} checked={show[k] !== false} onChange={(v) => updateGuestShow(k, v)} />
          ))}
        </div>
        <p className="text-[11px] text-slate-500 mt-1">Settings, Debug, Kobo View, Chat and all downloads are <b>always</b> hidden from guests.</p>
      </div>

      {/* Guest landing page */}
      <div className="border border-slate-200 rounded-lg p-3 space-y-2">
        <div className="text-xs font-semibold text-slate-700">Guest landing page (what the /view link shows)</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label="Title (blank = project name)"><input value={gl.projectName || ''} onChange={(e) => updateGuestLanding('projectName', e.target.value)} className="input"/></Field>
          <Field label="Tagline"><input value={gl.tagline ?? ''} onChange={(e) => updateGuestLanding('tagline', e.target.value)} placeholder="Water meter monitoring dashboard" className="input"/></Field>
        </div>
        <Field label="Description (blank = a generic line)"><textarea value={gl.description || ''} onChange={(e) => updateGuestLanding('description', e.target.value)} rows="2" className="input"/></Field>
        <div className="grid grid-cols-2 gap-1">
          <Toggle label="Show university names" checked={gl.showUniversities === true} onChange={(v) => updateGuestLanding('showUniversities', v)} />
          <Toggle label="Show research blurb" checked={gl.showResearchLine === true} onChange={(v) => updateGuestLanding('showResearchLine', v)} />
          <Toggle label="Show feature cards" checked={gl.showFeatures !== false} onChange={(v) => updateGuestLanding('showFeatures', v)} />
          <Toggle label="Show contact section" checked={gl.showContact === true} onChange={(v) => updateGuestLanding('showContact', v)} />
        </div>
        <p className="text-[11px] text-slate-500">By default the guest landing hides the universities, the research blurb and any “AWD” research wording.</p>
      </div>

      {/* Normal landing page */}
      <div className="border border-slate-200 rounded-lg p-3 space-y-2">
        <div className="text-xs font-semibold text-slate-700">Normal landing page (the public one everyone sees)</div>
        <Field label="Tagline override (blank = the Project info tagline)"><input value={lc.tagline || ''} onChange={(e) => updateLandingControls('tagline', e.target.value)} className="input"/></Field>
        <div className="grid grid-cols-2 gap-1">
          <Toggle label="Show university names" checked={lc.showUniversities !== false} onChange={(v) => updateLandingControls('showUniversities', v)} />
          <Toggle label="Show research blurb" checked={lc.showResearchLine !== false} onChange={(v) => updateLandingControls('showResearchLine', v)} />
          <Toggle label="Show feature cards" checked={lc.showFeatures !== false} onChange={(v) => updateLandingControls('showFeatures', v)} />
        </div>
        <div className="border-t border-slate-100 pt-2 mt-1">
          <Toggle label="🔒 Show the GENERIC landing to everyone who isn't logged in" checked={lc.publicGeneric === true} onChange={(v) => updateLandingControls('publicGeneric', v)} />
          <p className="text-[11px] text-slate-500 mt-1">Turn this on so that even the root URL (not just the <b>/view</b> link) hides your branding from anyone without a login — the safest way to share the guest link. (A web address itself can never be hidden, but this stops it revealing anything.)</p>
        </div>
        <p className="text-[11px] text-slate-500">The contact section on the normal landing is controlled in <b>📬 Contact info → Show on landing page</b>.</p>
      </div>
    </div>
  );
}

function CountTile({ label, value, sub, tone = 'slate' }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-900 border-emerald-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
  };
  return (
    <div className={`rounded-lg border p-2.5 ${tones[tone] || tones.slate}`}>
      <div className="text-xl font-bold tabular-nums leading-none">{value}</div>
      <div className="text-[11px] font-medium mt-0.5">{label}</div>
      {sub && <div className="text-[10px] opacity-70">{sub}</div>}
    </div>
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

// ---- Registry panel: turn farms and meters on/off ----
function RegistryPanel() {
  const [master, setMaster] = useState(null);      // { villages, pipes:[{serial,farm,village}] }
  const [offFarms, setOffFarms] = useState(new Set());
  const [offMeters, setOffMeters] = useState(new Set());
  const [q, setQ] = useState('');
  const [view, setView] = useState('all'); // all | active | off
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/registry').then((r) => r.json()).catch(() => ({ farms: [], pipes: [], master: null }))
      .then((d) => {
        setOffFarms(new Set((d.farms || []).map(String)));
        setOffMeters(new Set((d.pipes || []).map(String)));
        setMaster(d.master || null);
        setLoaded(true);
      });
  }, []);

  // Group the master meter list by farm for a compact on/off tree.
  const farms = {};
  if (master?.pipes) {
    for (const p of master.pipes) {
      const farm = p.farm || '(no farm)';
      if (!farms[farm]) farms[farm] = { village: p.village, meters: [] };
      farms[farm].meters.push(p.serial);
    }
  }
  // Live counts of how many farms and meters are active vs switched off.
  const totalFarms = Object.keys(farms).length;
  const totalMeters = master?.pipes?.length || 0;
  const meterIsOff = (serial, farm) => offMeters.has(serial) || offFarms.has(farm);
  let offMeterCount = 0;
  for (const [farm, info] of Object.entries(farms)) {
    for (const s of info.meters) if (meterIsOff(s, farm)) offMeterCount += 1;
  }
  const offFarmCount = Object.keys(farms).filter((f) => offFarms.has(f)).length;
  const activeFarms = totalFarms - offFarmCount;
  const activeMeters = totalMeters - offMeterCount;

  // Search accepts several IDs separated by commas. A farm matches if its own ID
  // matches OR any of its meters match.
  const terms = q.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
  const matches = (farm, meters) => {
    if (terms.length === 0) return true;
    return terms.some((t) => farm.toLowerCase().includes(t) || meters.some((p) => p.toLowerCase().includes(t)));
  };
  const matchesView = (farm) => view === 'all' || (view === 'active' ? !offFarms.has(farm) : offFarms.has(farm));
  const farmList = Object.entries(farms)
    .filter(([farm, info]) => matches(farm, info.meters) && matchesView(farm))
    .sort((a, b) => a[0].localeCompare(b[0]));

  function toggleSet(setter, set, key) {
    const next = new Set(set);
    next.has(key) ? next.delete(key) : next.add(key);
    setter(next);
  }
  async function save() {
    setBusy(true); setMsg('');
    try {
      const res = await fetch('/api/registry', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ farms: [...offFarms], pipes: [...offMeters] }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed');
      setMsg('✓ Saved. Disabled farms/meters are now hidden from surveyors.');
    } catch (e) { setMsg(`⚠️ ${e.message}`); }
    setBusy(false);
  }

  if (!loaded) return <div className="text-sm text-slate-500">Loading farms & meters…</div>;
  if (!master?.pipes?.length) return <div className="text-sm text-slate-500">No meter list available from the Kobo form yet. This reads the form&#39;s village→farm→meter choice lists; if your form uses a CSV media file for meters instead of choice lists, this list can&#39;t be built.</div>;

  return (
    <div className="space-y-3">
      {/* Live active / off summary — how many farms and meters are on the map */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <CountTile label="Active farms" value={activeFarms} sub={`of ${totalFarms}`} tone="emerald" />
        <CountTile label="Active meters" value={activeMeters} sub={`of ${totalMeters}`} tone="emerald" />
        <CountTile label="Farms off" value={offFarmCount} sub={offFarmCount ? 'hidden from surveyors' : 'none'} tone="slate" />
        <CountTile label="Meters off" value={offMeterCount} sub={offMeterCount ? 'incl. whole-farm off' : 'none'} tone="slate" />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search farm or meter IDs — separate with commas"
          className="input flex-1 min-w-[160px]" />
        <div className="flex bg-slate-100 rounded-lg p-0.5 text-xs">
          {[['all', 'All'], ['active', 'Active'], ['off', 'Off']].map(([k, lbl]) => (
            <button key={k} onClick={() => setView(k)}
              className={`px-2.5 py-1.5 rounded-md whitespace-nowrap transition ${view === k ? 'bg-brand-600 text-white font-medium' : 'text-slate-600 hover:bg-white'}`}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-[26rem] overflow-y-auto">
        {farmList.length === 0 && (
          <div className="p-4 text-center text-xs text-slate-400">
            {view === 'off' ? 'No farms are switched off.' : view === 'active' ? 'No active farms match.' : 'No farms match your search.'}
          </div>
        )}
        {farmList.map(([farm, info]) => {
          const farmOff = offFarms.has(farm);
          return (
            <div key={farm} className={`p-2.5 ${farmOff ? 'bg-slate-50 opacity-70' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-mono text-xs font-semibold truncate">{farm}</div>
                  <div className="text-[11px] text-slate-500">{info.village} · {info.meters.length} meter(s)</div>
                </div>
                <button onClick={() => toggleSet(setOffFarms, offFarms, farm)}
                  className={`shrink-0 text-xs px-2.5 py-1 rounded-full border ${farmOff ? 'bg-slate-200 text-slate-600 border-slate-300' : 'bg-emerald-50 text-emerald-700 border-emerald-300'}`}>
                  {farmOff ? '○ Off' : '● On'}
                </button>
              </div>
              {!farmOff && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {info.meters.map((serial) => {
                    const meterOff = offMeters.has(serial);
                    return (
                      <button key={serial} onClick={() => toggleSet(setOffMeters, offMeters, serial)}
                        className={`text-[11px] font-mono px-2 py-0.5 rounded border ${meterOff ? 'bg-slate-100 text-slate-400 border-slate-200 line-through' : 'bg-white text-slate-700 border-slate-300'}`}>
                        {serial}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {terms.length > 0 && farmList.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap bg-slate-50 border border-slate-200 rounded-lg p-2">
          <span className="text-xs text-slate-600">{farmList.length} farm(s) matched —</span>
          <button onClick={() => { const n = new Set(offFarms); farmList.forEach(([f]) => n.add(f)); setOffFarms(n); }}
            className="text-xs px-2.5 py-1 rounded border border-slate-400 text-slate-700 hover:bg-white">Turn all OFF</button>
          <button onClick={() => { const n = new Set(offFarms); farmList.forEach(([f]) => n.delete(f)); setOffFarms(n); }}
            className="text-xs px-2.5 py-1 rounded border border-emerald-400 text-emerald-700 hover:bg-white">Turn all ON</button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button onClick={save} disabled={busy}
          className="px-3 py-2 text-sm rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 disabled:opacity-50">
          {busy ? 'Saving…' : 'Save farm & meter settings'}
        </button>
        {msg && <span className="text-xs text-slate-700">{msg}</span>}
      </div>
      <p className="text-[11px] text-slate-500">Search several at once by separating IDs with commas, then use <b>Turn all OFF/ON</b>. Tap a farm's <b>On/Off</b> to disable the whole plot, or tap individual meter codes to disable just those. Disabled units vanish from surveyors, are excluded from red flags, and don't count toward missed readings.</p>
    </div>
  );
}
