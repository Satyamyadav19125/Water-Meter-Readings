'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AssignmentsPage() {
  const router = useRouter();
  const [assignments, setAssignments] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const isAdmin = user?.role === 'admin';

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [aRes, uRes] = await Promise.all([
        fetch('/api/assignments'),
        fetch('/api/auth/check'),
      ]);
      const aData = await aRes.json();
      if (!aRes.ok) throw new Error(aData.error || 'Failed to load');
      const uData = await uRes.json();
      setUser(uData.user || null);

      let list = aData.assignments || [];
      if (uData.user?.role === 'user') {
        list = list.filter((a) => a.person === uData.user.name);
      }
      setAssignments(list);
      setDirty(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/assignments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setMessage('Saved ✓');
      setDirty(false);
      setTimeout(() => setMessage(null), 2500);
      router.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function update(newList) {
    setAssignments(newList);
    setDirty(true);
  }

  function addPerson() {
    update([...assignments, { person: 'New Person', phone: '', email: '', password: '', meters: [] }]);
  }

  function updatePerson(i, field, value) {
    const copy = [...assignments];
    copy[i] = { ...copy[i], [field]: value };
    update(copy);
  }

  function deletePerson(i) {
    if (!confirm(`Delete ${assignments[i].person}?`)) return;
    update(assignments.filter((_, idx) => idx !== i));
  }

  function addMeter(personIdx) {
    const copy = [...assignments];
    copy[personIdx] = {
      ...copy[personIdx],
      meters: [...(copy[personIdx].meters || []), { village: '', serial: '' }],
    };
    update(copy);
  }

  function updateMeter(personIdx, meterIdx, field, value) {
    const copy = [...assignments];
    const meters = [...copy[personIdx].meters];
    meters[meterIdx] = { ...meters[meterIdx], [field]: value };
    copy[personIdx] = { ...copy[personIdx], meters };
    update(copy);
  }

  function deleteMeter(personIdx, meterIdx) {
    const copy = [...assignments];
    copy[personIdx] = {
      ...copy[personIdx],
      meters: copy[personIdx].meters.filter((_, idx) => idx !== meterIdx),
    };
    update(copy);
  }

  if (loading) return <p className="text-slate-500">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-xl font-semibold">
          {isAdmin ? 'Assignments' : 'My Meters'}
        </h2>
        {isAdmin && (
          <button
            onClick={save}
            disabled={!dirty || saving}
            className={`px-4 py-2 rounded text-sm font-medium ${
              dirty && !saving ? 'bg-brand-600 text-white hover:bg-brand-700' : 'bg-slate-200 text-slate-500 cursor-not-allowed'
            }`}
          >
            {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
          </button>
        )}
      </div>

      {message && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded p-2 text-sm">{message}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-800 rounded p-2 text-sm">{error}</div>}

      {!user && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-900">
          <a href="/login" className="underline font-medium">Log in</a> to view or manage assignments.
        </div>
      )}

      {isAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-900">
          <strong>Tip:</strong> The <em>Name</em> field must EXACTLY match the surveyor's "M Name" entered in the Kobo form, so their personal data filter works.
          The <em>Password</em> is what they will type to log in.
        </div>
      )}

      <div className="space-y-3">
        {assignments.map((person, i) => (
          <div key={i} className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-3 sm:p-4 border-b border-slate-100 bg-slate-50">
              {isAdmin ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] uppercase tracking-wide text-slate-500">Name</label>
                      <input
                        value={person.person}
                        onChange={(e) => updatePerson(i, 'person', e.target.value)}
                        placeholder="Name (matches Kobo M Name)"
                        className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wide text-slate-500">Login password</label>
                      <input
                        value={person.password || ''}
                        onChange={(e) => updatePerson(i, 'password', e.target.value)}
                        placeholder="Login password"
                        className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
                    <div>
                      <label className="text-[10px] uppercase tracking-wide text-slate-500">Phone</label>
                      <input
                        value={person.phone || ''}
                        onChange={(e) => updatePerson(i, 'phone', e.target.value)}
                        placeholder="Phone"
                        className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wide text-slate-500">Email</label>
                      <input
                        value={person.email || ''}
                        onChange={(e) => updatePerson(i, 'email', e.target.value)}
                        placeholder="Email"
                        className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                      />
                    </div>
                    <button
                      onClick={() => deletePerson(i)}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded text-sm"
                      title="Delete person"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="font-semibold">{person.person}</div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    {[person.phone, person.email].filter(Boolean).join(' · ')}
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 sm:p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Meters ({person.meters?.length || 0})</div>
              <div className="space-y-2">
                {(person.meters || []).map((m, j) => (
                  <div key={j} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                    {isAdmin ? (
                      <>
                        <input
                          value={m.village}
                          onChange={(e) => updateMeter(i, j, 'village', e.target.value)}
                          placeholder="Village"
                          className="px-2 py-1.5 border border-slate-200 rounded text-sm"
                        />
                        <input
                          value={m.serial}
                          onChange={(e) => updateMeter(i, j, 'serial', e.target.value)}
                          placeholder="Meter serial"
                          className="px-2 py-1.5 border border-slate-200 rounded text-sm font-mono"
                        />
                        <button
                          onClick={() => deleteMeter(i, j)}
                          className="text-red-600 hover:bg-red-50 rounded px-2 py-1.5 text-sm"
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="text-sm">{m.village}</div>
                        <div className="text-sm font-mono">{m.serial}</div>
                        <div></div>
                      </>
                    )}
                  </div>
                ))}
                {(!person.meters || person.meters.length === 0) && (
                  <div className="text-xs text-slate-400 italic">No meters yet</div>
                )}
              </div>
              {isAdmin && (
                <button
                  onClick={() => addMeter(i)}
                  className="mt-3 text-sm text-brand-600 hover:text-brand-700 font-medium"
                >
                  + Add meter
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {isAdmin && (
        <button
          onClick={addPerson}
          className="w-full bg-white border-2 border-dashed border-slate-300 rounded-lg py-4 text-slate-600 hover:border-brand-500 hover:text-brand-600 font-medium"
        >
          + Add person
        </button>
      )}
    </div>
  );
}
