'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AssignmentsPage() {
  const router = useRouter();
  const [assignments, setAssignments] = useState([]);
  const [user, setUser] = useState(null);
  const [surveyors, setSurveyors] = useState([]);
  const [allVillages, setAllVillages] = useState([]);
  const [pairings, setPairings] = useState({});
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
      const [aRes, uRes, sRes, vRes] = await Promise.all([
        fetch('/api/assignments'),
        fetch('/api/auth/check'),
        fetch('/api/surveyors').catch(() => null),
        fetch('/api/villages').catch(() => null),
      ]);
      const aData = await aRes.json();
      if (!aRes.ok) throw new Error(aData.error || 'Failed to load');
      const uData = await uRes.json();
      setUser(uData.user || null);
      if (sRes && sRes.ok) {
        const s = await sRes.json();
        setSurveyors(s.surveyors || []);
        setPairings(s.pairings || {});
      }
      if (vRes && vRes.ok) {
        const v = await vRes.json();
        setAllVillages(v.villages || []);
      }

      let list = aData.assignments || [];
      list = list.map((a) => {
        if (Array.isArray(a.villages)) return a;
        if (Array.isArray(a.meters)) {
          const villages = Array.from(new Set(a.meters.map((m) => m.village).filter(Boolean)));
          return { ...a, villages };
        }
        return { ...a, villages: [] };
      });

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
      const cleaned = assignments.map((a) => {
        const { meters, ...rest } = a;
        return { ...rest, villages: a.villages || [] };
      });
      const res = await fetch('/api/assignments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments: cleaned }),
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

  function update(newList) { setAssignments(newList); setDirty(true); }

  function addPerson(name = '') {
    update([
      ...assignments,
      { person: name, phone: '', email: '', password: '', villages: pairings[name] || [] },
    ]);
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

  function toggleVillage(personIdx, village) {
    const copy = [...assignments];
    const current = new Set(copy[personIdx].villages || []);
    if (current.has(village)) current.delete(village);
    else current.add(village);
    copy[personIdx] = { ...copy[personIdx], villages: Array.from(current).sort() };
    update(copy);
  }

  if (loading) return <p className="text-slate-500">Loading…</p>;

  const assignedNames = new Set(assignments.map((a) => a.person));
  const unassignedSurveyors = surveyors.filter((s) => !assignedNames.has(s));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-xl font-semibold">{isAdmin ? 'Assignments' : 'My Villages'}</h2>
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

      {isAdmin && unassignedSurveyors.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-sm font-semibold text-blue-900 mb-2">
            🧑 Surveyors found in Kobo data, not yet added here:
          </div>
          <div className="flex flex-wrap gap-2">
            {unassignedSurveyors.map((s) => (
              <button
                key={s}
                onClick={() => addPerson(s)}
                className="px-3 py-1 bg-white border border-blue-300 rounded-full text-sm hover:bg-blue-100"
              >
                + {s}
              </button>
            ))}
          </div>
          <div className="text-xs text-blue-700 mt-2">
            Click a name to create a user with that name. Then set their password and assign villages.
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-900">
          <strong>How it works:</strong> The <em>Name</em> must EXACTLY match the surveyor's "M Name" in Kobo.
          Assign the villages they're responsible for. They will see only readings from those villages.
        </div>
      )}

      <div className="space-y-3">
        {assignments.map((person, i) => {
          const personVillages = new Set(person.villages || []);
          const villageOptions = Array.from(new Set([...(allVillages || []), ...(person.villages || [])])).sort();
          return (
            <div key={i} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-3 sm:p-4 border-b border-slate-100 bg-slate-50">
                {isAdmin ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] uppercase tracking-wide text-slate-500">Name (matches Kobo M Name)</label>
                        <input
                          list="surveyor-names"
                          value={person.person}
                          onChange={(e) => updatePerson(i, 'person', e.target.value)}
                          placeholder="Type or pick surveyor name"
                          className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-medium"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-wide text-slate-500">Login password</label>
                        <input
                          value={person.password || ''}
                          onChange={(e) => updatePerson(i, 'password', e.target.value)}
                          placeholder="Choose a password"
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
                <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">
                  Villages assigned ({person.villages?.length || 0})
                </div>
                {isAdmin ? (
                  <div className="flex flex-wrap gap-1.5">
                    {villageOptions.length === 0 ? (
                      <span className="text-xs text-slate-400 italic">No villages found in Kobo data yet</span>
                    ) : villageOptions.map((v) => {
                      const active = personVillages.has(v);
                      return (
                        <button
                          key={v}
                          onClick={() => toggleVillage(i, v)}
                          className={`px-2.5 py-1 text-xs rounded-full border transition ${
                            active
                              ? 'bg-brand-600 text-white border-brand-600'
                              : 'bg-white text-slate-700 border-slate-300 hover:border-brand-500'
                          }`}
                        >
                          {active ? '✓ ' : ''}{v}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {(person.villages || []).map((v) => (
                      <span key={v} className="px-2.5 py-1 text-xs rounded-full bg-brand-50 text-brand-900 border border-brand-200">
                        {v}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isAdmin && (
        <button
          onClick={() => addPerson()}
          className="w-full bg-white border-2 border-dashed border-slate-300 rounded-lg py-4 text-slate-600 hover:border-brand-500 hover:text-brand-600 font-medium"
        >
          + Add person manually
        </button>
      )}

      <datalist id="surveyor-names">
        {surveyors.map((s) => <option key={s} value={s} />)}
      </datalist>
    </div>
  );
}
