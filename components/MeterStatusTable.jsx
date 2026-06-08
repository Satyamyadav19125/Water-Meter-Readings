'use client';

import { useEffect, useState, useMemo } from 'react';

const STATUS = {
  done:    { label: '✓ Done',         dot: 'bg-emerald-500', chip: 'bg-emerald-100 text-emerald-800 border-emerald-200', row: 'bg-emerald-50/40' },
  partial: { label: '1 of 2',         dot: 'bg-amber-500',   chip: 'bg-amber-100 text-amber-800 border-amber-200',       row: 'bg-amber-50/40' },
  pending: { label: 'Needs reading',  dot: 'bg-rose-500',    chip: 'bg-rose-100 text-rose-800 border-rose-200',          row: 'bg-rose-50/40' },
};

async function parseJsonSafe(res) {
  const text = await res.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { error: text.slice(0, 200) }; }
}

export default function MeterStatusTable() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('todo'); // todo | all | done
  const [q, setQ] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/meter-status');
        const d = await parseJsonSafe(res);
        if (!res.ok) throw new Error(d.error || 'Failed to load meters');
        if (alive) setData(d);
      } catch (e) { if (alive) setError(e.message); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const villages = useMemo(() => {
    if (!data?.villages) return [];
    const needle = q.trim().toLowerCase();
    return data.villages
      .map((v) => {
        let meters = v.meters;
        if (filter === 'todo') meters = meters.filter((m) => m.status !== 'done');
        else if (filter === 'done') meters = meters.filter((m) => m.status === 'done');
        if (needle) meters = meters.filter((m) => m.serial.toLowerCase().includes(needle));
        return { ...v, shownMeters: meters };
      })
      .filter((v) => v.shownMeters.length > 0 || (!needle && filter === 'all'));
  }, [data, filter, q]);

  if (loading) return <div className="h-40 bg-white rounded-xl shadow-sm animate-pulse" />;
  if (error) return <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">Couldn't load meter list: {error}</div>;
  if (!data || data.totals.total === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 text-center text-slate-500 text-sm">
        No meters found in your villages yet. Once readings start coming in, every meter will appear here with its weekly progress.
      </div>
    );
  }

  const t = data.totals;
  const weekStart = new Date(data.weekStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const weekEndShown = new Date(new Date(data.weekEnd).getTime() - 1).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const pct = t.total > 0 ? Math.round((t.done / t.total) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Summary header */}
      <div className="bg-gradient-to-br from-brand-50 to-field-50 border border-brand-100 rounded-xl p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="font-semibold text-base">📋 This week’s meter readings</div>
            <div className="text-xs text-slate-600 mt-0.5">
              {weekStart} – {weekEndShown} · each meter needs <b>2 readings</b> · {data.daysLeft} day{data.daysLeft === 1 ? '' : 's'} left
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums leading-none">{t.done}/{t.total}</div>
            <div className="text-[11px] text-slate-500">meters done</div>
          </div>
        </div>
        <div className="mt-3 h-2.5 bg-white/70 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex gap-3 mt-2 text-xs">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> {t.done} done</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> {t.partial} half</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> {t.pending} pending</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex bg-white rounded-lg shadow-sm p-0.5 text-sm">
          <FilterBtn active={filter === 'todo'} onClick={() => setFilter('todo')}>To do ({t.partial + t.pending})</FilterBtn>
          <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')}>All ({t.total})</FilterBtn>
          <FilterBtn active={filter === 'done'} onClick={() => setFilter('done')}>Done ({t.done})</FilterBtn>
        </div>
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search meter…"
          className="flex-1 min-w-[140px] px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
        />
      </div>

      {/* Per-village lists */}
      {villages.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-6 text-center text-emerald-700 text-sm">
          🎉 Nothing left to do here — every meter has been read twice this week!
        </div>
      ) : villages.map((v) => (
        <div key={v.village} className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
            <div className="font-semibold text-sm flex items-center gap-2">🏘️ {v.village}</div>
            <div className="text-xs text-slate-500">
              <span className="text-emerald-600 font-medium">{v.done} done</span> · {v.total} meters
            </div>
          </div>
          <ul className="divide-y divide-slate-100">
            {v.shownMeters.map((m) => {
              const st = STATUS[m.status];
              return (
                <li key={m.serial} className={`px-4 py-2.5 flex items-center gap-3 ${st.row}`}>
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${st.dot}`} />
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-sm truncate">{m.serial}</div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {m.lastDate
                        ? <>last: {m.lastReading ?? '—'} · {new Date(m.lastDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}{m.lastSurveyor ? ` · ${m.lastSurveyor}` : ''}</>
                        : 'no readings yet'}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full border font-medium ${st.chip}`}>{st.label}</span>
                    <div className="text-[10px] text-slate-400 mt-0.5 tabular-nums">{Math.min(m.countThisWeek, 2)}/2 this week</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function FilterBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`px-2.5 py-1.5 rounded-md whitespace-nowrap transition ${active ? 'bg-brand-600 text-white font-medium' : 'text-slate-600 hover:bg-slate-100'}`}>
      {children}
    </button>
  );
}
