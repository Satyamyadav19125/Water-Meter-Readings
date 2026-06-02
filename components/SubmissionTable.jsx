'use client';

import { useState } from 'react';
import { getField } from '@/lib/fieldMap';

export default function SubmissionTable({ submissions, flags }) {
  const [expanded, setExpanded] = useState(null);

  if (submissions.length === 0) {
    return <p className="text-slate-600">No submissions yet.</p>;
  }

  return (
    <div className="overflow-x-auto bg-white rounded shadow">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-100 text-left">
          <tr>
            <th className="p-2 w-8"></th>
            <th className="p-2">When</th>
            <th className="p-2">Village</th>
            <th className="p-2">Meter serial</th>
            <th className="p-2">Start</th>
            <th className="p-2">End</th>
            <th className="p-2">Flag</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((s) => {
            const id = s._id;
            const flag = flags[id];
            const isOpen = expanded === id;
            return (
              <FragmentRow
                key={id}
                submission={s}
                isOpen={isOpen}
                flag={flag}
                onToggle={() => setExpanded(isOpen ? null : id)}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FragmentRow({ submission, isOpen, flag, onToggle }) {
  const s = submission;
  const rowClass = flag ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-slate-50';
  return (
    <>
      <tr className={`border-t cursor-pointer ${rowClass}`} onClick={onToggle}>
        <td className="p-2">{isOpen ? '▼' : '▶'}</td>
        <td className="p-2 whitespace-nowrap">{new Date(s._submission_time).toLocaleString()}</td>
        <td className="p-2">{getField(s, 'village') || '—'}</td>
        <td className="p-2 font-mono text-xs">{getField(s, 'serial') || '—'}</td>
        <td className="p-2">{getField(s, 'startReading') ?? '—'}</td>
        <td className="p-2">{getField(s, 'endReading') ?? '—'}</td>
        <td className="p-2">
          {flag ? <span className="text-red-700 font-semibold">🚩 {flag.flags[0].type}</span> : <span className="text-slate-400">—</span>}
        </td>
      </tr>
      {isOpen && (
        <tr className="border-t bg-slate-50">
          <td colSpan={7} className="p-4">
            <SubmissionDetail submission={s} flag={flag} />
          </td>
        </tr>
      )}
    </>
  );
}

function SubmissionDetail({ submission, flag }) {
  const photos = submission._attachments || [];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        {flag && (
          <div className="mb-3 border border-red-300 bg-red-100 rounded p-3 text-red-900">
            <div className="font-semibold mb-1">🚩 Red flag</div>
            <ul className="list-disc pl-5 text-sm">
              {flag.flags.map((f, i) => <li key={i}>{f.message}</li>)}
            </ul>
          </div>
        )}
        <table className="w-full text-sm">
          <tbody>
            {Object.entries(submission)
              .filter(([k]) => !k.startsWith('_') && k !== 'meta/instanceID' && k !== 'formhub/uuid')
              .map(([k, v]) => (
                <tr key={k} className="border-t">
                  <td className="py-1.5 pr-3 font-medium text-slate-700 align-top w-1/3">{k}</td>
                  <td className="py-1.5 align-top break-all">{renderValue(v)}</td>
                </tr>
              ))}
          </tbody>
        </table>
        <div className="text-xs text-slate-500 mt-2">
          Submission ID #{submission._id} · UUID {submission._uuid}
        </div>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">
          Photos ({photos.length})
        </div>
        {photos.length === 0 ? (
          <p className="text-slate-500 text-sm">No photo attached.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {photos.map((a) => (
              <a key={a.id} href={`/api/photo?url=${encodeURIComponent(a.download_url)}`} target="_blank" rel="noreferrer">
                <img
                  src={`/api/photo?url=${encodeURIComponent(a.download_small_url || a.download_url)}`}
                  alt={a.filename}
                  className="w-full h-40 object-cover rounded border"
                />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function renderValue(v) {
  if (v === null || v === undefined || v === '') return <em className="text-slate-400">empty</em>;
  if (typeof v === 'object') return <code className="text-xs">{JSON.stringify(v)}</code>;
  return String(v);
}
