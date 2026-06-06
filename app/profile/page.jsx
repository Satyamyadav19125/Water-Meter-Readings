'use client';

import { useEffect, useState } from 'react';

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ phone: '', email: '', photo: '', bio: '', password: '', confirmPassword: '' });

  useEffect(() => {
    fetch('/api/profile').then((r) => r.json()).then((d) => {
      if (d.profile) {
        setProfile(d.profile);
        setForm({
          phone: d.profile.phone || '',
          email: d.profile.email || '',
          photo: d.profile.photo || '',
          bio: d.profile.bio || '',
          password: '',
          confirmPassword: '',
        });
      } else {
        setError(d.error || 'Not logged in');
      }
      setLoading(false);
    });
  }, []);

  async function save(e) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (form.password && form.password !== form.confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    setSaving(true);
    const body = {
      phone: form.phone,
      email: form.email,
      photo: form.photo,
      bio: form.bio,
    };
    if (form.password) body.password = form.password;
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error || 'Save failed'); return; }
    setMessage(data.passwordChanged ? 'Saved · password updated ✓' : 'Saved ✓');
    setForm((f) => ({ ...f, password: '', confirmPassword: '' }));
    setTimeout(() => setMessage(null), 3000);
  }

  if (loading) return <p className="text-slate-500">Loading…</p>;
  if (error && !profile) return (
    <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
      {error} · <a href="/login" className="underline">Log in</a>
    </div>
  );
  if (profile.role === 'admin') return (
    <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-900">
      Admin uses the env-var password and has no editable profile. Manage surveyor profiles via Assignments.
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="bg-white rounded-xl shadow p-5 sm:p-6">
        <div className="flex items-center gap-4 mb-4">
          {form.photo ? (
            <img src={form.photo} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-brand-200" onError={(e) => { e.target.style.display = 'none'; }} />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand-100 to-field-100 flex items-center justify-center text-2xl">
              👤
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold">{profile.name}</h1>
            <p className="text-xs text-slate-500">Surveyor · {profile.villages?.length || 0} villages assigned</p>
          </div>
        </div>

        {(profile.villages || []).length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {profile.villages.map((v) => (
              <span key={v} className="px-2.5 py-0.5 text-xs rounded-full bg-field-50 text-field-900 border border-field-200">
                🏘️ {v}
              </span>
            ))}
          </div>
        )}

        {message && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded p-2 text-sm mb-3">{message}</div>}
        {error && <div className="bg-red-50 border border-red-200 text-red-800 rounded p-2 text-sm mb-3">{error}</div>}

        <form onSubmit={save} className="space-y-3">
          <Field label="Photo URL (paste a link to an online photo)">
            <input type="url" value={form.photo} onChange={(e) => setForm({ ...form, photo: e.target.value })} placeholder="https://…" className="profile-input" />
          </Field>
          <Field label="Bio (a short line about yourself)">
            <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows="2" placeholder="e.g. Field assistant since 2023, based in Patiala" className="profile-input" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Phone">
              <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91…" className="profile-input" />
            </Field>
            <Field label="Email">
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" className="profile-input" />
            </Field>
          </div>

          <details className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
            <summary className="cursor-pointer text-sm font-medium">🔑 Change password</summary>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="New password">
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="profile-input" />
              </Field>
              <Field label="Confirm new password">
                <input type="password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} className="profile-input" />
              </Field>
            </div>
            <p className="text-xs text-slate-500 mt-2">Leave blank to keep your current password.</p>
          </details>

          <button type="submit" disabled={saving} className="w-full bg-brand-600 text-white py-2.5 rounded-lg font-medium hover:bg-brand-700 disabled:bg-slate-300">
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </form>

        <style jsx>{`
          :global(.profile-input) {
            width: 100%; padding: 0.625rem 0.75rem; border: 1px solid #cbd5e1;
            border-radius: 0.5rem; font-size: 0.875rem;
          }
          :global(.profile-input:focus) { outline: 2px solid #0ea5e9; outline-offset: -1px; }
        `}</style>
      </div>
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
