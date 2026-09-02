'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PhotoUpload from '@/components/PhotoUpload';
import MeterStatusTable from '@/components/MeterStatusTable';
import Lightbox from '@/components/Lightbox';

// Never throw "Unexpected end of JSON input" on an empty/non-JSON response.
async function parseJsonSafe(res) {
  const text = await res.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { error: text.slice(0, 200) || 'Unexpected server response' }; }
}

export default function AssignmentsPage() {
  const router = useRouter();
  const [assignments, setAssignments] = useState([]);
  const [user, setUser] = useState(null);
  const [surveyors, setSurveyors] = useState([]);
  const [allVillages, setAllVillages] = useState([]);
  const [pairings, setPairings] = useState({});
  const [stats, setStats] = useState({}); // surveyor name -> reading stats
  const [statsMeta, setStatsMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [showPasswords, setShowPasswords] = useState(false);
  const [lb, setLb] = useState(null);

  const isAdmin = user?.role === 'admin';

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [aRes, uRes, sRes, vRes, stRes] = await Promise.all([
        fetch('/api/assignments'),
        fetch('/api/auth/check'),
        fetch('/api/surveyors').catch(() => null),
        fetch('/api/villages').catch(() => null),
        fetch('/api/surveyor-stats').catch(() => null),
      ]);
      const aData = await parseJsonSafe(aRes);
      if (!aRes.ok) throw new Error(aData.error || 'Failed to load');
      const uData = await parseJsonSafe(uRes);
      setUser(uData.user || null);
      if (sRes && sRes.ok) {
        const s = await parseJsonSafe(sRes);
        setSurveyors(s.surveyors || []);
        setPairings(s.pairings || {});
      }
      if (vRes && vRes.ok) {
        const v = await parseJsonSafe(vRes);
        setAllVillages(v.villages || []);
      }
      if (stRes && stRes.ok) {
        const st = await parseJsonSafe(stRes);
        const byName = {};
        for (const row of (st.surveyors || [])) byName[String(row.name).trim().toLowerCase()] = row;
        setStats(byName);
        setStatsMeta({ periodLabel: st.periodLabel || 'week' });
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
      if (uData.user?.role === 'user') list = list.filter((a) => a.person === uData.user.name);
      setAssignments(list);
      setDirty(false);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function save() {
    setSaving(true);
    setError(null); setMessage(null);
    try {
      const cleaned = assignments.map((a) => { const { meters, ...rest } = a; return { ...rest, villages: a.villages || [] }; });
      const res = await fetch('/api/assignments', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments: cleaned }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setMessage('Saved ✓');
      setDirty(false);
      setTimeout(() => setMessage(null), 2500);
      router.refresh();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  function update(newList) { setAssignments(newList); setDirty(true); }
  function addPerson(name = '') {
    update([...assignments, { person: name, phone: '', email: '', password: '', photo: '', bio: '', villages: pairings[name] || [] }]);
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
    if (current.has(village)) current.delete(village); else current.add(village);
    copy[personIdx] = { ...copy[personIdx], villages: Array.from(current).sort() };
    update(copy);
  }

  if (loading) return <p className="text-slate-500">Loading…</p>;

  const assignedNames = new Set(assignments.map((a) => a.person));
  const unassignedSurveyors = surveyors.filter((s) => !assignedNames.has(s));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-xl font-semibold">{isAdmin ? '👥 Assignments' : '🏘️ My Villages'}</h2>
        <div className="flex gap-2">
          {isAdmin && (
            <button onClick={() => setShowPasswords(!showPasswords)} className="px-3 py-1.5 rounded border border-slate-300 text-xs hover:bg-slate-50">
              {showPasswords ? '🙈 Hide passwords' : '👁️ Show passwords'}
            </button>
          )}
          {isAdmin && (
            <button onClick={save} disabled={!dirty || saving}
              className={`px-4 py-2 rounded text-sm font-medium ${dirty && !saving ? 'bg-brand-600 text-white hover:bg-brand-700' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}>
              {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
            </button>
          )}
        </div>
      </div>

      {message && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded p-2 text-sm">{message}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-800 rounded p-2 text-sm">{error}</div>}

      {!user && <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-900"><a href="/login" className="underline font-medium">Log in</a> to view or manage assignments.</div>}

      {/* Team productivity summary — at a glance, how much the whole team has
          produced this period and who is leading. */}
      {isAdmin && <TeamSummary stats={stats} periodLabel={statsMeta?.periodLabel || 'week'} />}

      {/* People & villages come FIRST — the meter tracker lives in the
          "Missed readings" tab so the same table isn't shown twice. */}
      {isAdmin && (
        <h3 className="text-base font-semibold text-slate-800 mb-1">👥 People & villages</h3>
      )}

      {/* Field assistant: villages FIRST, weekly tracker after */}
      {user && !isAdmin && (
        <h3 className="text-sm font-semibold text-slate-700">🏘️ Your villages</h3>
      )}

      {isAdmin && unassignedSurveyors.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-sm font-semibold text-blue-900 mb-2">🧑 Surveyors found in Kobo data, not yet added here:</div>
          <div className="flex flex-wrap gap-2">
            {unassignedSurveyors.map((s) => (
              <button key={s} onClick={() => addPerson(s)} className="px-3 py-1 bg-white border border-blue-300 rounded-full text-sm hover:bg-blue-100">+ {s}</button>
            ))}
          </div>
          <div className="text-xs text-blue-700 mt-2">Click a name to add them. Set a password and pick their villages.</div>
        </div>
      )}

      <div className="space-y-3">
        {assignments.map((person, i) => {
          const personVillages = new Set(person.villages || []);
          const villageOptions = Array.from(new Set([...(allVillages || []), ...(person.villages || [])])).sort();
          return (
            <div key={i} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-3 sm:p-4 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-brand-50/30">
                <div className="flex items-center gap-3 mb-3">
                  {person.photo ? (
                    <button type="button" onClick={() => setLb(person.photo)} title="Tap to view photo">
                      <img src={person.photo} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-white shadow cursor-zoom-in" onError={(e) => { e.target.style.display = 'none'; }}/>
                    </button>
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-100 to-field-100 flex items-center justify-center text-xl">👤</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{person.person || <em className="text-slate-400">No name</em>}</div>
                    {person.bio && <div className="text-xs text-slate-500 truncate">{person.bio}</div>}
                  </div>
                  {isAdmin && (
                    <button onClick={() => deletePerson(i)} className="text-red-600 hover:bg-red-50 px-2 py-1 rounded text-sm">🗑️</button>
                  )}
                </div>

                {isAdmin ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Field label="Name (must match Kobo's M Name)">
                        <input list="surveyor-names" value={person.person} onChange={(e) => updatePerson(i, 'person', e.target.value)} placeholder="Surveyor name" className="aw-input"/>
                      </Field>
                      <Field label="Password">
                        <input type={showPasswords ? 'text' : 'password'} value={person.password || ''} onChange={(e) => updatePerson(i, 'password', e.target.value)} placeholder="Login password" className="aw-input font-mono"/>
                      </Field>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Field label="Phone">
                        <input value={person.phone || ''} onChange={(e) => updatePerson(i, 'phone', e.target.value)} placeholder="+91…" className="aw-input"/>
                      </Field>
                      <Field label="Email">
                        <input value={person.email || ''} onChange={(e) => updatePerson(i, 'email', e.target.value)} placeholder="email" className="aw-input"/>
                      </Field>
                    </div>
                    <PhotoUpload value={person.photo} onChange={(url) => updatePerson(i, 'photo', url)} label="Photo" showPreview={false} />
                    <Field label="Bio">
                      <input value={person.bio || ''} onChange={(e) => updatePerson(i, 'bio', e.target.value)} placeholder="Short bio" className="aw-input"/>
                    </Field>
                    <label className="flex items-center gap-2 mt-1 cursor-pointer select-none">
                      <input type="checkbox" checked={person.showFlags === true}
                        onChange={(e) => updatePerson(i, 'showFlags', e.target.checked)}
                        className="w-4 h-4 accent-brand-600" />
                      <span className="text-sm text-slate-700">🚩 Let this surveyor see their own red flags</span>
                    </label>
                    <p className="text-[11px] text-slate-500 -mt-1 ml-6">When on, {person.person || 'this surveyor'} sees the mistakes flagged on their submissions. When off (default), they only see a clean positive view.</p>
                  </div>
                ) : (
                  <div className="text-xs text-slate-600">
                    {[person.phone, person.email].filter(Boolean).join(' · ')}
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
                      <span className="text-xs text-slate-400 italic">No villages found yet in Kobo data</span>
                    ) : villageOptions.map((v) => {
                      const active = personVillages.has(v);
                      return (
                        <button key={v} onClick={() => toggleVillage(i, v)}
                          className={`px-2.5 py-1 text-xs rounded-full border transition ${active ? 'bg-field-600 text-white border-field-600' : 'bg-white text-slate-700 border-slate-300 hover:border-field-500'}`}>
                          {active ? '✓ ' : ''}{v}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {(person.villages || []).map((v) => (
                      <span key={v} className="px-2.5 py-1 text-xs rounded-full bg-field-50 text-field-900 border border-field-200">🏘️ {v}</span>
                    ))}
                  </div>
                )}
              </div>

              <SurveyorProgress stat={stats[String(person.person || '').trim().toLowerCase()]} periodLabel={statsMeta?.periodLabel || 'week'} />
            </div>
          );
        })}
      </div>

      {user && !isAdmin && (
        <div className="pt-2">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">📋 Weekly meter tracker</h3>
          <MeterStatusTable />
        </div>
      )}

      {isAdmin && (
        <button onClick={() => addPerson()} className="w-full bg-white border-2 border-dashed border-slate-300 rounded-xl py-4 text-slate-600 hover:border-brand-500 hover:text-brand-600 font-medium">
          + Add person manually
        </button>
      )}

      {lb && <Lightbox src={lb} onClose={() => setLb(null)} label="Profile photo" />}

      <datalist id="surveyor-names">
        {surveyors.map((s) => <option key={s} value={s} />)}
      </datalist>

      <style jsx>{`
        :global(.aw-input) {
          width: 100%; padding: 0.5rem 0.625rem; border: 1px solid #cbd5e1;
          border-radius: 0.5rem; font-size: 0.875rem; background: white;
        }
        :global(.aw-input:focus) { outline: 2px solid #0ea5e9; outline-offset: -1px; }
      `}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

// "Work done" strip on a person card: how many readings this field assistant has
// actually taken (all-time + this period), how many distinct meters, and how
// long since they were last active — so the admin can spot who has gone quiet.
function relDays(iso) {
  if (!iso) return null;
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  return `${d} days ago`;
}
function SurveyorProgress({ stat, periodLabel }) {
  if (!stat) {
    return (
      <div className="px-3 sm:px-4 py-2.5 border-t border-slate-100 bg-slate-50/60">
        <div className="text-[11px] text-slate-400">No readings recorded yet for this person.</div>
      </div>
    );
  }
  const last = relDays(stat.lastActive);
  const stale = stat.lastActive && (Date.now() - new Date(stat.lastActive).getTime()) > 10 * 86400000;
  return (
    <div className="px-3 sm:px-4 py-2.5 border-t border-slate-100 bg-slate-50/60">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">📊 Readings taken</span>
        {last && (
          <span className={`text-[11px] ${stale ? 'text-rose-600 font-medium' : 'text-slate-500'}`}>
            {stale ? '⚠️ ' : ''}last active {last}
          </span>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2">
        <Stat n={stat.total} label="total" />
        <Stat n={stat.thisPeriod} label={`this ${periodLabel}`} accent />
        <Stat n={stat.meters} label="meters" />
        <Stat n={stat.villages} label="villages" />
      </div>
    </div>
  );
}
// Whole-team roll-up shown to admins above the roster.
function TeamSummary({ stats, periodLabel }) {
  const list = Object.values(stats || {});
  if (list.length === 0) return null;
  const total = list.reduce((a, s) => a + (s.total || 0), 0);
  const thisPeriod = list.reduce((a, s) => a + (s.thisPeriod || 0), 0);
  const active = list.filter((s) => (s.thisPeriod || 0) > 0).length;
  const top = list.slice().sort((a, b) => (b.thisPeriod || 0) - (a.thisPeriod || 0))[0];
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 font-medium mb-2">📊 Team activity</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat n={thisPeriod} label={`readings this ${periodLabel}`} accent />
        <Stat n={total} label="readings all-time" />
        <Stat n={`${active}/${list.length}`} label={`active this ${periodLabel}`} />
        <div className="rounded-lg px-2 py-1.5 text-center bg-white border border-slate-200">
          <div className="text-sm font-bold text-slate-800 truncate" title={top?.name}>{top && top.thisPeriod > 0 ? top.name : '—'}</div>
          <div className="text-[10px] text-slate-500 leading-tight">most active</div>
        </div>
      </div>
    </div>
  );
}
function Stat({ n, label, accent }) {
  return (
    <div className={`rounded-lg px-2 py-1.5 text-center ${accent ? 'bg-brand-50 border border-brand-100' : 'bg-white border border-slate-200'}`}>
      <div className={`text-base font-bold tabular-nums ${accent ? 'text-brand-700' : 'text-slate-800'}`}>{n}</div>
      <div className="text-[10px] text-slate-500 leading-tight">{label}</div>
    </div>
  );
}
