'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getField } from '@/lib/fieldMap';
import { readingTime } from '@/lib/redflags';
import Lightbox from '@/components/Lightbox';
import MiniMap from '@/components/MiniMap';

// Kobo time "16:00:00.000+05:30" -> "16:00" for display; blank stays "—".
function fmtTime(v) {
  const m = /(\d{1,2}):(\d{2})/.exec(String(v || ''));
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
}

// Parse a Kobo location value ("lat lng alt acc" string, or _geolocation array)
// into { lat, lng } for the mini-map. Returns null when there's no usable GPS.
function parseSubLoc(submission) {
  const raw = getField(submission, 'location');
  if (typeof raw === 'string') {
    const p = raw.trim().split(/\s+/).map(Number);
    if (p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])) return { lat: p[0], lng: p[1] };
  }
  const geo = submission._geolocation;
  if (Array.isArray(geo) && geo.length >= 2 && Number.isFinite(Number(geo[0])) && Number.isFinite(Number(geo[1]))) {
    return { lat: Number(geo[0]), lng: Number(geo[1]) };
  }
  return null;
}

// Fields already shown on the collapsed card (village, farm, pipe id) — hidden
// from the expanded "Form data" list so the detail doesn't repeat the header.
const DETAIL_SKIP_SEGMENTS = new Set([
  'village', 'village_name', 'q2', 'farm', 'farm_id', 'pipes', 'pipe', 'pipe_id', 'serial', 'meter_id',
]);

export default function SubmissionList({ submissions, flags, allSubmissions, canVerify = false, verifiedIds = [], duplicates = {}, sections = null }) {
  const router = useRouter();
  const [openId, setOpenId] = useState(null);
  const [verified, setVerified] = useState(() => new Set(verifiedIds.map(String)));
  const [busyId, setBusyId] = useState(null);

  const byId = {};
  for (const s of (allSubmissions || submissions)) byId[s._id] = s;

  const renderCard = (s) => {
    const isOpen = openId === s._id;
    return (
      <SubmissionCard
        key={s._id}
        submission={s}
        isOpen={isOpen}
        flag={flags[s._id]}
        isVerified={verified.has(String(s._id))}
        canVerify={canVerify}
        busy={busyId === s._id}
        onToggleVerify={toggleVerify}
        onToggle={() => setOpenId(isOpen ? null : s._id)}
        byId={byId}
        dupOthers={duplicates[s._id] || null}
      />
    );
  };

  async function toggleVerify(id, makeVerified) {
    setBusyId(id);
    try {
      const res = await fetch('/api/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: id, verified: makeVerified }),
      });
      if (res.ok) {
        setVerified((prev) => {
          const next = new Set(prev);
          if (makeVerified) next.add(String(id)); else next.delete(String(id));
          return next;
        });
        // Soft refresh so the Verified / Flagged / Clean tab counts update.
        router.refresh();
      }
    } catch {}
    finally { setBusyId(null); }
  }

  if (submissions.length === 0) {
    return <p className="text-slate-500 bg-white rounded-lg shadow p-6 text-center">No submissions match the current filter.</p>;
  }

  // Grouped view (the All tab): scroll through category by category.
  if (Array.isArray(sections) && sections.length > 0) {
    return (
      <div className="space-y-4">
        {sections.map((sec) => (
          <div key={sec.key} className="space-y-2">
            <div className="sticky top-[56px] z-[300] -mx-1 px-3 py-1.5 rounded-lg bg-slate-100/95 backdrop-blur text-sm font-semibold text-slate-700 border border-slate-200">
              {sec.label} <span className="font-normal text-slate-400">({sec.items.length})</span>
            </div>
            {sec.items.map((s) => renderCard(s))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {submissions.map((s) => {
        const isOpen = openId === s._id;
        const flag = flags[s._id];
        const isVerified = verified.has(String(s._id));
        return (
          <SubmissionCard
            key={s._id}
            submission={s}
            isOpen={isOpen}
            flag={flag}
            isVerified={isVerified}
            canVerify={canVerify}
            busy={busyId === s._id}
            onToggleVerify={toggleVerify}
            onToggle={() => setOpenId(isOpen ? null : s._id)}
            byId={byId}
            dupOthers={duplicates[s._id] || null}
          />
        );
      })}
    </div>
  );
}

function SubmissionCard({ submission, isOpen, flag, isVerified, canVerify, busy, onToggleVerify, onToggle, byId, dupOthers }) {
  const s = submission;
  const village = getField(s, 'village');
  const serial = getField(s, 'serial');
  const endR = getField(s, 'endReading');
  const surveyor = getField(s, 'surveyor');
  const time = new Date(s._submission_time);
  const showRed = flag && !isVerified;
  const corr = s._correction || null;
  const isDead = corr && corr.field === 'dead';
  const dupCount = Array.isArray(dupOthers) ? dupOthers.length : 0;
  const cardClass = isDead ? 'bg-slate-100 border-slate-300 opacity-75'
    : showRed ? 'bg-red-50 border-red-200' : isVerified && flag ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200';

  return (
    <div className={`rounded-lg shadow-sm border overflow-hidden ${cardClass}`}>
      <button onClick={onToggle} className="w-full text-left p-3 sm:p-4 flex items-center gap-3 hover:bg-black/[0.02]">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            {isDead && <span title="Dead reading — ignored by the tool">🗑️</span>}
            {!isDead && showRed && <span className="text-red-600">🚩</span>}
            {!isDead && corr && <span title="Reading corrected">✎</span>}
            {isVerified && flag && <span className="text-emerald-600" title="Marked correct by admin">✓</span>}
            {dupCount > 0 && <span title={`This meter was read ${dupCount + 1}× on this date — open to compare`}>👯</span>}
            <span className={`font-medium truncate ${isDead ? 'line-through text-slate-500' : ''}`}>{village || '—'}</span>
            {surveyor && <span className="text-xs text-slate-500 truncate">· {surveyor}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-600">
            <span className="font-mono">{serial || '—'}</span>
            {getField(s, 'farm') && <span className="font-mono text-[11px] text-slate-400">🌾 {getField(s, 'farm')}</span>}
            <span>{time.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-base font-bold tabular-nums ${isDead ? 'line-through text-slate-400' : ''}`}>{endR ?? '—'}</div>
          <div className="text-xs text-slate-500">reading</div>
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      {isOpen && (
        <SubmissionDetail
          submission={s} flag={flag} isVerified={isVerified} canVerify={canVerify}
          busy={busy} onToggleVerify={onToggleVerify} byId={byId} dupOthers={dupOthers}
        />
      )}
    </div>
  );
}

function SubmissionDetail({ submission, flag, isVerified, canVerify, busy, onToggleVerify, byId, dupOthers }) {
  // Show the side-by-side comparison whenever a duplicate partner exists —
  // either flagged (rollback/huge-jump/duplicate) or detected as a same-day
  // duplicate, so both forms are always reviewable even with flags turned off.
  const flagTarget = flag?.flags.find((f) => f.previousSubmissionId)?.previousSubmissionId;
  const dupIds = Array.isArray(dupOthers) ? dupOthers : [];
  // All partners to compare against — the flagged "previous" plus every same-day
  // duplicate — so 3+ readings on one day are all shown together (N-way).
  const otherIds = Array.from(new Set([flagTarget, ...dupIds].filter(Boolean)))
    .filter((id) => String(id) !== String(submission._id));
  const others = otherIds.map((id) => byId[id]).filter(Boolean);
  const isSameDayDup = !flagTarget && others.length > 0;

  return (
    <div className="border-t border-slate-200/60 p-3 sm:p-4 space-y-4">
      {isSameDayDup && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-indigo-900 text-sm">
          <span className="font-semibold">👯 Read {others.length + 1} times on this date.</span> All {others.length + 1} forms are shown below — decide which is correct, then correct the value or mark the mistaken one(s) as deleted. A deleted one stays here for reference and the kept one moves to Clean.
        </div>
      )}
      {flag && isVerified && (
        <div className="bg-emerald-100 border border-emerald-300 rounded-lg p-3 text-emerald-900">
          <div className="font-semibold mb-1 flex items-center gap-2">✓ Marked correct by admin</div>
          <p className="text-sm">This submission was flagged automatically but an admin reviewed it and confirmed it's fine, so it no longer counts as a red flag.</p>
          {canVerify && (
            <button onClick={() => onToggleVerify(submission._id, false)} disabled={busy}
              className="mt-2 text-xs px-3 py-1.5 rounded-lg border border-emerald-400 text-emerald-800 hover:bg-emerald-50 disabled:opacity-50">
              {busy ? 'Working…' : '↺ Undo — flag it again'}
            </button>
          )}
        </div>
      )}

      {flag && !isVerified && (
        <div className="bg-red-100 border border-red-300 rounded-lg p-3 text-red-900">
          <div className="font-semibold mb-1.5 flex items-center gap-2">🚩 Red flag</div>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {flag.flags.map((f, i) => <li key={i}><strong className="capitalize">{(f.type || '').replace(/_/g, ' ')}:</strong> {f.message}</li>)}
          </ul>
          {canVerify && (
            <button onClick={() => onToggleVerify(submission._id, true)} disabled={busy}
              className="mt-2.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50">
              {busy ? 'Working…' : '✓ Mark this submission as correct'}
            </button>
          )}
        </div>
      )}

      {canVerify && <ReadingCorrection submission={submission} />}

      {others.length > 0 ? (
        <DuplicateCompare current={submission} others={others} canVerify={canVerify} />
      ) : (
        <SubmissionPanel label="Form data" submission={submission} />
      )}

      {canVerify && <FullFormEditor submission={submission} />}
    </div>
  );
}

// Side-by-side comparison of same-day readings, differences highlighted, so the
// admin can see WHY one is wrong. Each reading can be independently corrected,
// confirmed correct, or marked as a mistake — because two reads on the same day
// at different times can BOTH be legitimate.
const COMPARE_FIELDS = [
  ['date', 'Date'], ['startTime', 'Start'], ['endTime', 'End'], ['surveyor', 'Surveyor'],
  ['village', 'Village'], ['farm', 'Farm ID'], ['serial', 'Meter ID'],
  ['reading', 'Reading'], ['location', 'GPS'],
];
function DuplicateCompare({ current, others, canVerify }) {
  const router = useRouter();
  const [busy, setBusy] = useState('');
  const [lb, setLb] = useState(null);
  const [editId, setEditId] = useState('');   // which reading's value is being edited
  const [editVal, setEditVal] = useState('');
  // Show readings EARLIEST-FIRST (by the field time), so the first reading of the
  // day is column 1. The opened card is tagged "(this one)".
  const columns = [current, ...others]
    .slice()
    .sort((a, b) => readingTime(a) - readingTime(b));
  const val = (sub, key) => {
    if (key === 'reading') return getField(sub, 'endReading') ?? getField(sub, 'reading') ?? '';
    return getField(sub, key) ?? '';
  };
  const dispVal = (sub, key) => {
    const raw = val(sub, key);
    if (key === 'startTime' || key === 'endTime') return fmtTime(raw);
    return String(raw);
  };
  const isDeadSub = (sub) => sub._correction && sub._correction.field === 'dead';
  const isCorrectedSub = (sub) => sub._correction && sub._correction.field !== 'dead';
  const nameOf = (i, sub) => `Reading ${i + 1}${String(sub._id) === String(current._id) ? ' (this one)' : ''}`;
  // Don't show a Farm row at all when none of the readings have a farm.
  const rowsToShow = COMPARE_FIELDS.filter(([key]) =>
    key !== 'farm' || columns.some((sub) => String(val(sub, 'farm')).trim() !== ''));

  async function post(body) {
    setBusy(body.submissionId);
    try {
      const res = await fetch('/api/corrections', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      router.refresh();
    } catch (e) { alert(e.message); }
    setBusy(''); setEditId('');
  }
  async function verify(sub) {
    setBusy(sub._id);
    try {
      const res = await fetch('/api/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: sub._id, verified: true }),
      });
      if (!res.ok) throw new Error('Failed');
      router.refresh();
    } catch (e) { alert(e.message); }
    setBusy('');
  }
  function markDead(sub) {
    const note = window.prompt('Why is this reading a mistake? (short note — optional)', '');
    if (note === null) return;
    post({ submissionId: sub._id, field: 'dead', oldValue: val(sub, 'reading'), note });
  }
  function saveEdit(sub) {
    if (String(editVal).trim() === '') { alert('Enter the corrected reading.'); return; }
    post({ submissionId: sub._id, field: 'reading', oldValue: val(sub, 'reading'), newValue: String(editVal).trim(), note: 'Corrected from duplicate review' });
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">⚖️ Comparison — {columns.length} readings (earliest first), differences highlighted</div>
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2 text-[11px] text-indigo-900">
        Two reads on the same day <b>at different times can both be correct</b>. Use <b>✓ Correct</b> on each to keep them, <b>✎ Edit</b> to fix a value, or <b>🗑️ Mistake</b> to delete a genuine duplicate.
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-slate-200 rounded-lg">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left px-2 py-1.5 font-medium text-slate-500 whitespace-nowrap">Field</th>
              {columns.map((sub, i) => (
                <th key={sub._id} className="text-left px-2 py-1.5 font-medium whitespace-nowrap">
                  {nameOf(i, sub)} <span className="font-mono text-[10px] text-slate-400">#{String(sub._id).slice(-5)}</span>
                  {isDeadSub(sub) && <span className="ml-1 text-[10px] text-slate-500">🗑️ deleted</span>}
                  {isCorrectedSub(sub) && <span className="ml-1 text-[10px] text-emerald-600">✎ corrected</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowsToShow.map(([key, label]) => {
              const vals = columns.map((sub) => dispVal(sub, key));
              const allSame = vals.every((x) => x === vals[0]);
              return (
                <tr key={key} className={`border-t border-slate-100 ${allSame ? '' : 'bg-amber-50'}`}>
                  <td className="px-2 py-1 text-slate-500 whitespace-nowrap">{label}</td>
                  {vals.map((x, i) => (
                    <td key={i} className={`px-2 py-1 ${allSame ? '' : 'font-semibold text-amber-800'}`}>{x || '—'}</td>
                  ))}
                </tr>
              );
            })}
            {canVerify && (
              <tr className="border-t border-slate-200 bg-slate-50/60 align-top">
                <td className="px-2 py-2 text-slate-500 whitespace-nowrap">Actions</td>
                {columns.map((sub) => (
                  <td key={sub._id} className="px-2 py-2">
                    {isDeadSub(sub) ? (
                      <span className="text-[11px] text-slate-500">🗑️ deleted</span>
                    ) : editId === String(sub._id) ? (
                      <div className="flex flex-col gap-1">
                        <input type="number" value={editVal} onChange={(e) => setEditVal(e.target.value)}
                          className="w-24 px-2 py-1 rounded border border-amber-400 text-xs" placeholder="new reading" />
                        <div className="flex gap-1">
                          <button onClick={() => saveEdit(sub)} disabled={busy === sub._id} className="text-[11px] px-2 py-0.5 rounded bg-amber-600 text-white disabled:opacity-50">Save</button>
                          <button onClick={() => setEditId('')} className="text-[11px] px-2 py-0.5 rounded border border-slate-300">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <button onClick={() => { setEditId(String(sub._id)); setEditVal(String(val(sub, 'reading'))); }} disabled={!!busy}
                          className="text-[11px] px-2 py-0.5 rounded border border-amber-400 text-amber-800 hover:bg-amber-50 disabled:opacity-50 whitespace-nowrap">✎ Edit</button>
                        <button onClick={() => verify(sub)} disabled={!!busy}
                          className="text-[11px] px-2 py-0.5 rounded border border-emerald-400 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 whitespace-nowrap">✓ Correct</button>
                        <button onClick={() => markDead(sub)} disabled={!!busy}
                          className="text-[11px] px-2 py-0.5 rounded border border-slate-400 text-slate-700 hover:bg-slate-100 disabled:opacity-50 whitespace-nowrap">🗑️ Mistake</button>
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Photos side-by-side — the whole point of a duplicate review is seeing
          which reading's PHOTO is wrong/missing, so show every form's pictures
          under its column. Tap to zoom. */}
      <div className="space-y-1">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">📷 Photos — compare the readings</div>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
          {columns.map((sub, i) => {
            const photos = uniquePhotos(sub._attachments);
            return (
              <div key={sub._id} className="space-y-1">
                <div className="text-[11px] font-medium text-slate-600 truncate">
                  {nameOf(i, sub)} <span className="font-mono text-[10px] text-slate-400">#{String(sub._id).slice(-5)}</span>
                </div>
                {photos.length > 0 ? (
                  <div className="space-y-1">
                    {photos.slice(0, 2).map((a) => (
                      <figure key={a.uid || a.id || a.filename} className="m-0">
                        <button type="button" onClick={() => setLb(`/api/photo?url=${encodeURIComponent(a.download_url)}`)} className="block w-full">
                          <img
                            src={`/api/photo?url=${encodeURIComponent(a.download_small_url || a.download_url)}`}
                            alt={labelForPhoto(a)}
                            className="w-full h-28 sm:h-36 object-cover rounded border border-slate-200 cursor-zoom-in"
                          />
                        </button>
                        <figcaption className="text-[10px] text-slate-500 mt-0.5 text-center truncate">{labelForPhoto(a)}</figcaption>
                      </figure>
                    ))}
                  </div>
                ) : (
                  <div className="h-28 sm:h-36 rounded border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-[10px] text-slate-400 text-center px-1">
                    No photo
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {lb && <Lightbox src={lb} onClose={() => setLb(null)} label="Meter photo" />}
    </div>
  );
}

// Full-form editor: admin edits ANY field of a submission. Saved as an override
// (raw Kobo untouched); the edited values flow through the whole tool. This is
// how you fix a submission where something other than the reading is wrong.
const EDITABLE = [
  ['group_1/date', 'Date', 'date'], ['group_1/start_time', 'Start time', 'startTime'],
  ['group_1/end_time', 'End time', 'endTime'], ['group_1/m_name', 'Surveyor name', 'name'],
  ['group_1/Q2', 'Village', 'village'], ['group_2/farm', 'Farm ID', 'farm'],
  ['group_2/meter_id', 'Meter ID', 'serial'],
  ['group_2/reading', 'Reading', 'reading'], ['group_2/location', 'GPS (lat lng)', 'location'],
];
// Which input control each field uses in the editor.
function fieldKind(logical) {
  if (logical === 'date') return 'date';
  if (logical === 'startTime' || logical === 'endTime') return 'time';
  if (logical === 'name') return 'surveyor';
  if (logical === 'village') return 'village';
  if (logical === 'farm') return 'farm';
  if (logical === 'serial') return 'meter';
  if (logical === 'reading') return 'number';
  return 'text';
}
// Build a <select>'s option list: the known choices plus the current value
// (so an existing value that isn't in the master list is never lost), sorted.
function withCurrent(list, cur) {
  return Array.from(new Set([...(list || []), cur].filter((x) => x != null && String(x).trim() !== '')))
    .sort((a, b) => String(a).localeCompare(String(b)));
}
// Kobo time "16:00:00.000+05:30" <-> the <input type=time> "16:00" value.
function toTimeInput(v) {
  const m = /(\d{1,2}):(\d{2})/.exec(String(v || ''));
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
}
function fromTimeInput(hhmm) {
  return hhmm ? `${hhmm}:00.000+05:30` : '';
}
// Kobo date is already YYYY-MM-DD (strip any time part just in case).
function toDateInput(v) {
  const m = /(\d{4}-\d{2}-\d{2})/.exec(String(v || ''));
  return m ? m[1] : '';
}

function FullFormEditor({ submission }) {
  const existing = submission._correction && submission._correction.field === 'fields'
    ? (submission._correction.fields || {}) : {};
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [surveyors, setSurveyors] = useState([]);
  // Master farm / pipe / village lists (from the Kobo form) so those fields are
  // picked from a dropdown instead of typed. `rows` maps pipe → farm → village
  // so the Pipe list can narrow to the chosen farm.
  const [master, setMaster] = useState(null);
  const router = useRouter();

  function currentVal(path, logical) {
    if (path in existing) return existing[path];
    if (path in submission) return submission[path];
    return getField(submission, logical) ?? '';
  }
  function begin() {
    const seed = {};
    for (const [path, , logical] of EDITABLE) seed[path] = String(currentVal(path, logical) ?? '');
    setVals(seed); setOpen(true); setErr('');
    // Load the surveyor names for that dropdown.
    fetch('/api/surveyors').then((r) => r.json()).then((d) => setSurveyors(Array.isArray(d.surveyors) ? d.surveyors : [])).catch(() => {});
    // Load the full farm / pipe / village lists for the pickers.
    fetch('/api/registry').then((r) => r.json()).then((d) => {
      const rows = (d && d.master && Array.isArray(d.master.pipes)) ? d.master.pipes : [];
      const farms = Array.from(new Set(rows.map((p) => p.farm).filter(Boolean)));
      const villages = Array.from(new Set([...(d?.master?.villages || []), ...rows.map((p) => p.village).filter(Boolean)]));
      const pipes = Array.from(new Set(rows.map((p) => p.serial).filter(Boolean)));
      setMaster({ rows, farms, villages, pipes });
    }).catch(() => {});
  }
  async function save() {
    // Only send fields that actually changed from the raw value.
    const changed = {};
    for (const [path, , logical] of EDITABLE) {
      const raw = String(submission[path] ?? getField(submission, logical) ?? '');
      if (String(vals[path] ?? '') !== raw) changed[path] = vals[path];
    }
    if (Object.keys(changed).length === 0) { setErr('Nothing changed.'); return; }
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/corrections', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: submission._id, field: 'fields', fields: changed, note }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) throw new Error(d.error || `Save failed (HTTP ${res.status})`);
      router.refresh();
      setBusy(false); setOpen(false);
    } catch (e) { setErr(e.message); setBusy(false); }
  }
  async function revert() {
    setBusy(true);
    try {
      const res = await fetch(`/api/corrections?id=${encodeURIComponent(submission._id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      router.refresh();
      setBusy(false); setOpen(false);
    } catch (e) { setErr(e.message); setBusy(false); }
  }

  if (!open) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={begin} className="text-xs px-3 py-1.5 rounded-lg border border-sky-400 text-sky-700 hover:bg-sky-50">
          ✏️ Edit full form
        </button>
        {Object.keys(existing).length > 0 && (
          <>
            <span className="text-xs text-emerald-700">✎ {Object.keys(existing).length} field(s) edited</span>
            <button onClick={revert} disabled={busy} className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50">↺ Revert all</button>
          </>
        )}
      </div>
    );
  }
  return (
    <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 space-y-2">
      <div className="text-sm font-semibold text-sky-900">✏️ Edit full form <span className="font-normal text-xs text-slate-500">— raw Kobo data stays untouched; the tool uses your edits everywhere</span></div>
      {/* Which reading is being edited — so it's never a mystery which form's
          values these are. */}
      <div className="text-xs text-slate-700 bg-white border border-sky-200 rounded px-2.5 py-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="text-slate-500">Editing:</span>
        <b className="font-mono">{getField(submission, 'serial') || '—'}</b>
        <span className="text-slate-400">·</span>
        <span>{getField(submission, 'village') || '—'}</span>
        {getField(submission, 'farm') && <>
          <span className="text-slate-400">·</span>
          <span className="font-mono text-[11px]">🌾 {getField(submission, 'farm')}</span>
        </>}
        <span className="text-slate-400">·</span>
        <span className="text-slate-400">#{String(submission._id).slice(-5)}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {EDITABLE.map(([path, label, logical]) => {
          // Hide the Farm field entirely when the form has no farms and this
          // submission has no farm value (nothing to edit).
          if (logical === 'farm' && !getField(submission, 'farm') && (!master || (master.farms || []).length === 0)) return null;
          const raw = String(submission[path] ?? getField(submission, logical) ?? '');
          const changed = String(vals[path] ?? '') !== raw;
          const kind = fieldKind(logical);
          const cls = `w-full px-2 py-1.5 rounded border text-sm ${changed ? 'border-amber-400 bg-amber-50' : 'border-slate-300'}`;
          let control;
          if (kind === 'date') {
            control = <input type="date" value={toDateInput(vals[path])} onChange={(e) => setVals({ ...vals, [path]: e.target.value })} className={cls} />;
          } else if (kind === 'time') {
            control = <input type="time" value={toTimeInput(vals[path])} onChange={(e) => setVals({ ...vals, [path]: fromTimeInput(e.target.value) })} className={cls} />;
          } else if (kind === 'surveyor') {
            const cur = String(vals[path] ?? '');
            const opts = Array.from(new Set([cur, ...surveyors].filter(Boolean)));
            control = (
              <select value={cur} onChange={(e) => setVals({ ...vals, [path]: e.target.value })} className={cls}>
                {!cur && <option value="">— choose surveyor —</option>}
                {opts.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            );
          } else if (kind === 'village' || kind === 'farm' || kind === 'meter') {
            const cur = String(vals[path] ?? '');
            // The Meter list narrows to the currently-chosen farm (if that farm
            // has known meters); otherwise it shows every meter.
            let list = [];
            if (master) {
              if (kind === 'village') list = master.villages;
              else if (kind === 'farm') list = master.farms;
              else {
                const selFarm = String(vals['group_2/farm'] ?? '');
                const forFarm = selFarm ? master.rows.filter((r) => String(r.farm) === selFarm).map((r) => r.serial) : [];
                list = forFarm.length ? forFarm : master.pipes;
              }
            }
            const label = kind === 'village' ? 'village' : kind === 'farm' ? 'farm ID' : 'meter ID';
            control = master ? (
              <select value={cur} onChange={(e) => setVals({ ...vals, [path]: e.target.value })} className={cls}>
                {!cur && <option value="">— choose {label} —</option>}
                {withCurrent(list, cur).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            ) : (
              // Master list still loading — stay editable with a plain input.
              <input value={vals[path] ?? ''} onChange={(e) => setVals({ ...vals, [path]: e.target.value })} className={cls} placeholder={`Loading ${label}s…`} />
            );
          } else if (kind === 'number') {
            control = <input type="number" value={vals[path] ?? ''} onChange={(e) => setVals({ ...vals, [path]: e.target.value })} className={cls} />;
          } else {
            control = <input value={vals[path] ?? ''} onChange={(e) => setVals({ ...vals, [path]: e.target.value })} className={cls} />;
          }
          return (
            <label key={path} className="block">
              <span className="text-[11px] text-slate-500">{label}{changed && <span className="text-amber-600"> ●</span>}</span>
              {control}
            </label>
          );
        })}
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for the edit (optional)"
        className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm" />
      {err && <div className="text-xs text-red-600">{err}</div>}
      <div className="flex gap-2">
        <button onClick={save} disabled={busy} className="text-xs px-3 py-1.5 rounded-lg bg-sky-600 text-white font-medium hover:bg-sky-700 disabled:opacity-50">{busy ? 'Saving…' : 'Save edits'}</button>
        <button onClick={() => setOpen(false)} className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600">Cancel</button>
      </div>
    </div>
  );
}

// Admin-only reading review. Two independent actions on a submission:
//  1. CORRECT the value — raw Kobo untouched; tool uses the corrected number
//     everywhere so the wrong value stops triggering red flags. Shows old→new.
//  2. Mark as a DEAD reading — submitted by mistake (e.g. a duplicate where the
//     OTHER reading is the correct one). The row stays on Kobo but the tool
//     ignores it entirely: no flags, not counted, off the map/analytics.
function ReadingCorrection({ submission }) {
  const existing = submission._correction || null;
  const isDead = existing && existing.field === 'dead';
  const rawValue = existing && existing.field !== 'dead'
    ? existing.oldValue
    : (getField(submission, 'endReading') ?? getField(submission, 'reading') ?? '');
  const [mode, setMode] = useState(null); // null | 'value' | 'dead'
  const [newValue, setNewValue] = useState(existing && !isDead ? existing.newValue : '');
  const [note, setNote] = useState(existing ? (existing.note || '') : '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const router = useRouter();
  async function post(body) {
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/corrections', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: submission._id, ...body }),
      });
      let data = {};
      try { data = await res.json(); } catch {}
      if (!res.ok || !data.ok) throw new Error(data.error || `Save failed (HTTP ${res.status})`);
      // Soft refresh (no full page reload): the server re-renders with the new
      // correction overlaid, so this row moves into Corrected/Clean/Deleted.
      router.refresh();
      setBusy(false); setMode(null);
    } catch (e) { setErr(e.message); setBusy(false); }
  }
  const saveValue = () => {
    if (String(newValue).trim() === '') { setErr('Enter the corrected reading.'); return; }
    post({ field: 'reading', oldValue: rawValue, newValue: String(newValue).trim(), note });
  };
  const markDead = () => post({ field: 'dead', oldValue: rawValue, note });
  const beginDead = () => { setErr(''); setNote(existing ? (existing.note || '') : ''); setMode('dead'); };
  async function revert() {
    setBusy(true); setErr('');
    try {
      const res = await fetch(`/api/corrections?id=${encodeURIComponent(submission._id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Revert failed');
      router.refresh();
      setBusy(false); setMode(null);
    } catch (e) { setErr(e.message); setBusy(false); }
  }

  // --- Already marked dead ---
  if (isDead) {
    return (
      <div className="bg-slate-100 border border-slate-300 rounded-lg p-3">
        <div className="text-sm font-semibold text-slate-700">🗑️ Marked as a dead reading (submitted by mistake)</div>
        <div className="text-xs text-slate-500 mt-0.5">
          Raw value {existing.oldValue ?? '—'} is still on Kobo but the tool ignores this reading everywhere — no flags, not counted, off the map.
          {existing.note ? ` Note: ${existing.note}.` : ''} by {existing.by || 'admin'}{existing.at ? ` · ${new Date(existing.at).toLocaleDateString()}` : ''}
        </div>
        {err && <div className="text-xs text-red-600 mt-1">{err}</div>}
        <button onClick={revert} disabled={busy} className="mt-2 text-xs px-3 py-1.5 rounded-lg border border-slate-400 text-slate-700 hover:bg-white disabled:opacity-50">
          ↺ Restore this reading
        </button>
      </div>
    );
  }

  // --- Already value-corrected ---
  if (existing) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <div className="text-sm"><span className="font-semibold text-amber-900">✎ Reading corrected</span></div>
        <div className="mt-1 flex items-center gap-2 flex-wrap text-sm">
          <span className="line-through text-slate-500">{existing.oldValue ?? '—'}</span>
          <span className="text-slate-400">→</span>
          <span className="font-bold text-emerald-700">{existing.newValue}</span>
        </div>
        {existing.note && <div className="text-xs text-slate-600 mt-1">Note: {existing.note}</div>}
        <div className="text-[11px] text-slate-500 mt-0.5">by {existing.by || 'admin'}. Tool uses the corrected value everywhere; raw Kobo data untouched.</div>
        {err && <div className="text-xs text-red-600 mt-1">{err}</div>}
        <div className="flex gap-2 mt-2 flex-wrap">
          <button onClick={() => { setMode('value'); setNewValue(existing.newValue); }} className="text-xs px-3 py-1.5 rounded-lg border border-amber-400 text-amber-800 hover:bg-amber-100">✎ Edit</button>
          <button onClick={revert} disabled={busy} className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50">↺ Revert to raw ({existing.oldValue ?? '—'})</button>
        </div>
        {mode === 'value' && (
          <ValueForm rawValue={rawValue} newValue={newValue} setNewValue={setNewValue} note={note} setNote={setNote} err={err} busy={busy} onSave={saveValue} onCancel={() => setMode(null)} />
        )}
      </div>
    );
  }

  // --- No correction yet: offer both actions ---
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
      {mode === null && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-600 mr-1">Reading looks wrong?</span>
          <button onClick={() => setMode('value')} className="text-xs px-3 py-1.5 rounded-lg border border-amber-400 text-amber-800 hover:bg-amber-100">✎ Correct the value</button>
          <button onClick={beginDead} className="text-xs px-3 py-1.5 rounded-lg border border-slate-400 text-slate-700 hover:bg-slate-100">🗑️ Mark as dead (mistake / duplicate)</button>
        </div>
      )}
      {mode === 'value' && (
        <ValueForm rawValue={rawValue} newValue={newValue} setNewValue={setNewValue} note={note} setNote={setNote} err={err} busy={busy} onSave={saveValue} onCancel={() => setMode(null)} />
      )}
      {mode === 'dead' && (
        <DeadForm note={note} setNote={setNote} err={err} busy={busy} onConfirm={markDead} onCancel={() => setMode(null)} />
      )}
      {err && mode === null && <div className="text-xs text-red-600 mt-1">{err}</div>}
    </div>
  );
}

function ValueForm({ rawValue, newValue, setNewValue, note, setNote, err, busy, onSave, onCancel }) {
  return (
    <div className="space-y-2 mt-2">
      <div className="text-xs text-slate-600">Raw Kobo reading: <b>{rawValue || '—'}</b> — enter the corrected value:</div>
      <div className="flex items-center gap-2 flex-wrap">
        <input type="number" value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="e.g. 2000" className="w-28 px-2 py-1.5 rounded border border-slate-300 text-sm" />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason (optional)" className="flex-1 min-w-[140px] px-2 py-1.5 rounded border border-slate-300 text-sm" />
      </div>
      {err && <div className="text-xs text-red-600">{err}</div>}
      <div className="flex gap-2">
        <button onClick={onSave} disabled={busy} className="text-xs px-3 py-1.5 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-700 disabled:opacity-50">{busy ? 'Saving…' : 'Save correction'}</button>
        <button onClick={onCancel} className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600">Cancel</button>
      </div>
    </div>
  );
}

// Note field shown before a reading is marked dead, so the admin records WHY
// (mistake, duplicate, wrong pipe, etc.). The note is saved and displayed on
// the dead reading afterwards.
function DeadForm({ note, setNote, err, busy, onConfirm, onCancel }) {
  return (
    <div className="space-y-2">
      <div className="text-xs text-slate-600">Why is this reading dead? (mistake, duplicate, wrong pipe…). This note is saved with the dead reading.</div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
        placeholder="e.g. Duplicate of the reading taken the same day — this one is the mistake."
        className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm" />
      {err && <div className="text-xs text-red-600">{err}</div>}
      <div className="flex gap-2">
        <button onClick={onConfirm} disabled={busy} className="text-xs px-3 py-1.5 rounded-lg bg-slate-700 text-white font-medium hover:bg-slate-800 disabled:opacity-50">{busy ? 'Saving…' : '🗑️ Confirm dead reading'}</button>
        <button onClick={onCancel} disabled={busy} className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 disabled:opacity-50">Cancel</button>
      </div>
    </div>
  );
}

function SubmissionPanel({ label, submission, highlight }) {
  const [lb, setLb] = useState(null);
  const photos = uniquePhotos(submission._attachments);
  const borderClass = highlight === 'red'
    ? 'border-red-300 bg-red-50'
    : highlight === 'emerald'
      ? 'border-emerald-300 bg-emerald-50'
      : 'border-slate-200 bg-slate-50';

  return (
    <div className={`rounded-lg border ${borderClass} p-3`}>
      <div className="text-xs uppercase tracking-wide text-slate-600 font-semibold mb-2">{label}</div>
      <div className="text-xs text-slate-500 mb-2">
        #{submission._id} · {new Date(submission._submission_time).toLocaleString()}
      </div>
      {/* Key facts, always shown (start/end time included) so nothing important
          is buried in the raw field list below. */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mb-3 bg-white/60 rounded-lg border border-slate-200 p-2">
        <Fact k="Date" v={getField(submission, 'date')} />
        <Fact k="Reading" v={getField(submission, 'endReading') ?? getField(submission, 'reading')} strong />
        <Fact k="Start time" v={fmtTime(getField(submission, 'startTime'))} />
        <Fact k="End time" v={fmtTime(getField(submission, 'endTime'))} />
        <Fact k="Surveyor" v={getField(submission, 'surveyor')} />
        <Fact k="Village" v={getField(submission, 'village')} />
        {getField(submission, 'farm') && <Fact k="Farm ID" v={getField(submission, 'farm')} />}
        <Fact k="Meter ID" v={getField(submission, 'serial')} mono />
      </div>
      <dl className="space-y-1 mb-3">
        {Object.entries(submission)
          .filter(([k]) => !k.startsWith('_') && !k.includes('/uuid') && !k.includes('/instanceID'))
          // Don't repeat village / farm / pipe ID — they're already on the card.
          .filter(([k]) => !DETAIL_SKIP_SEGMENTS.has(k.split('/').pop().toLowerCase()))
          .slice(0, 10)
          .map(([k, v]) => (
            <div key={k} className="grid grid-cols-[110px_1fr] gap-2 text-xs">
              <dt className="text-slate-500 truncate">{prettyKey(k)}</dt>
              <dd className="text-slate-900 break-all">{renderVal(v)}</dd>
            </div>
          ))}
      </dl>
      {(() => {
        const loc = parseSubLoc(submission);
        if (!loc) return null;
        return (
          <div className="mb-3">
            <div className="text-[11px] text-slate-500 mb-1">📍 Where this reading was taken</div>
            <MiniMap lat={loc.lat} lng={loc.lng} label={getField(submission, 'serial') || 'Reading location'} />
            <a target="_blank" rel="noreferrer"
              href={`https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`}
              className="inline-block mt-1.5 text-[11px] px-2.5 py-1 rounded-full bg-field-600 text-white font-medium hover:bg-field-700">
              🧭 Directions
            </a>
          </div>
        );
      })()}
      {photos.length > 0 && (
        <div className={`grid ${photos.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
          {photos.slice(0, 2).map((a) => (
            <figure key={a.uid || a.id || a.filename} className="m-0">
              <button type="button" onClick={() => setLb(`/api/photo?url=${encodeURIComponent(a.download_url)}`)} className="block w-full">
                <img
                  src={`/api/photo?url=${encodeURIComponent(a.download_small_url || a.download_url)}`}
                  alt={labelForPhoto(a)}
                  className="w-full h-36 object-cover rounded border border-slate-200 cursor-zoom-in"
                />
              </button>
              <figcaption className="text-[10px] text-slate-500 mt-1 text-center">{labelForPhoto(a)}</figcaption>
            </figure>
          ))}
        </div>
      )}
      {lb && <Lightbox src={lb} onClose={() => setLb(null)} label="Meter photo" />}
    </div>
  );
}


// Two photos per pipe submission: the reading close-up and the wider field
// shot. Label each so they read as two distinct photos, and dedupe by filename.
function labelForPhoto(a) {
  const q = String(a.question_xpath || a.filename || '').toLowerCase();
  if (q.includes('photo_reading')) return 'Reading photo';
  if (q.includes('field_photo')) return 'Field photo';
  return 'Photo';
}
function uniquePhotos(atts) {
  const seen = new Set(); const out = [];
  for (const a of (atts || [])) {
    const base = a.media_file_basename || a.filename || a.download_url || '';
    if (seen.has(base)) continue;
    seen.add(base); out.push(a);
  }
  return out;
}

function Fact({ k, v, mono, strong }) {
  const empty = v == null || v === '';
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-500 shrink-0">{k}</span>
      <span className={`text-right ${mono ? 'font-mono' : ''} ${strong ? 'font-semibold' : ''} ${empty ? 'text-slate-300' : 'text-slate-900'}`}>{empty ? '—' : String(v)}</span>
    </div>
  );
}

function prettyKey(k) {
  return k.replace(/^group_\d+\//, '').replace(/_/g, ' ');
}

function renderVal(v) {
  if (v === null || v === undefined || v === '') return <em className="text-slate-400">empty</em>;
  if (typeof v === 'object') return <code className="text-xs">{JSON.stringify(v)}</code>;
  return String(v);
}
