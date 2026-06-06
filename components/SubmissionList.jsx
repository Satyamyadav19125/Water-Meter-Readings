'use client';

import { useState } from 'react';
import { getField } from '@/lib/fieldMap';

export default function SubmissionList({ submissions, flags, allSubmissions }) {
  const [openId, setOpenId] = useState(null);

  const byId = {};
  for (const s of (allSubmissions || submissions)) byId[s._id] = s;

  if (submissions.length === 0) {
    return <p className="text-slate-500 bg-white rounded-lg shadow p-6 text-center">No submissions match the current filter.</p>;
  }

  return (
    <div className="space-y-2">
      {submissions.map((s) => {
        const isOpen = openId === s._id;
        const flag = flags[s._id];
        return (
          <SubmissionCard
            key={s._id}
            submission={s}
            isOpen={isOpen}
            flag={flag}
            onToggle={() => setOpenId(isOpen ? null : s._id)}
            byId={byId}
          />
        );
      })}
    </div>
  );
}

function SubmissionCard({ submission, isOpen, flag, onToggle, byId }) {
  const s = submission;
  const village = getField(s, 'village');
  const serial = getField(s, 'serial');
  const endR = getField(s, 'endReading');
  const surveyor = getField(s, 'surveyor');
  const time = new Date(s._submission_time);
  const cardClass = flag ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200';

  return (
    <div className={`rounded-lg shadow-sm border overflow-hidden ${cardClass}`}>
      <button onClick={onToggle} className="w-full text-left p-3 sm:p-4 flex items-center gap-3 hover:bg-black/[0.02]">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            {flag && <span className="text-red-600">🚩</span>}
            <span className="font-medium truncate">{village || '—'}</span>
            {surveyor && <span className="text-xs text-slate-500 truncate">· {surveyor}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-600">
            <span className="font-mono">{serial || '—'}</span>
            <span>{time.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-base font-bold tabular-nums">{endR ?? '—'}</div>
          <div className="text-xs text-slate-500">reading</div>
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      {isOpen && <SubmissionDetail submission={s} flag={flag} byId={byId} />}
    </div>
  );
}

function SubmissionDetail({ submission, flag, byId }) {
  const compareTarget = flag?.flags.find((f) => f.previousSubmissionId)?.previousSubmissionId;
  const previous = compareTarget ? byId[compareTarget] : null;

  return (
    <div className="border-t border-slate-200/60 p-3 sm:p-4 space-y-4">
      {flag && (
        <div className="bg-red-100 border border-red-300 rounded-lg p-3 text-red-900">
          <div className="font-semibold mb-1.5 flex items-center gap-2">🚩 Red flag</div>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {flag.flags.map((f, i) => <li key={i}><strong className="capitalize">{(f.type || '').replace(/_/g, ' ')}:</strong> {f.message}</li>)}
          </ul>
        </div>
      )}

      {previous ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <SubmissionPanel label="Previous reading" submission={previous} highlight="emerald" />
          <SubmissionPanel label="Current reading (flagged)" submission={submission} highlight="red" />
        </div>
      ) : (
        <SubmissionPanel label="Form data" submission={submission} />
      )}
    </div>
  );
}

function SubmissionPanel({ label, submission, highlight }) {
  const photos = submission._attachments || [];
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
      <dl className="space-y-1 mb-3">
        {Object.entries(submission)
          .filter(([k]) => !k.startsWith('_') && !k.includes('/uuid') && !k.includes('/instanceID'))
          .slice(0, 10)
          .map(([k, v]) => (
            <div key={k} className="grid grid-cols-[110px_1fr] gap-2 text-xs">
              <dt className="text-slate-500 truncate">{prettyKey(k)}</dt>
              <dd className="text-slate-900 break-all">{renderVal(v)}</dd>
            </div>
          ))}
      </dl>
      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {photos.slice(0, 2).map((a) => (
            <a key={a.id} href={`/api/photo?url=${encodeURIComponent(a.download_url)}`} target="_blank" rel="noreferrer" className="block">
              <img
                src={`/api/photo?url=${encodeURIComponent(a.download_small_url || a.download_url)}`}
                alt={a.filename}
                className="w-full h-36 object-cover rounded border border-slate-200"
              />
            </a>
          ))}
        </div>
      )}
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
