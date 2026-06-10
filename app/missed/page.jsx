'use client';

import { useEffect, useState } from 'react';
import MeterStatusTable from '@/components/MeterStatusTable';

function isoDaysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

export default function MissedPage() {
  const [user, setUser] = useState(undefined); // undefined = loading
  const [date, setDate] = useState(''); // empty = last week (default)

  useEffect(() => {
    fetch('/api/auth/check').then((r) => r.json()).then((d) => setUser(d.user || null)).catch(() => setUser(null));
  }, []);

  if (user === undefined) return <div className="h-40 bg-white rounded-xl shadow-sm animate-pulse" />;
  if (!user) return (
    <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-900">
      <a href="/login" className="underline font-medium">Log in</a> to view this page.
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">📌 Missed readings</h2>
        <p className="text-sm text-slate-500">
          Meters that were NOT read twice in the selected week. Pick any date — you'll see the whole week containing it.
        </p>
      </div>

      {/* Week picker */}
      <div className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-2 flex-wrap">
        <label className="text-xs font-medium text-slate-600">📅 Show week of:</label>
        <input type="date" value={date} max={isoDaysAgo(0)} onChange={(e) => setDate(e.target.value)}
          className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm" />
        <div className="flex gap-1.5 ml-auto">
          <QuickBtn active={!date} onClick={() => setDate('')}>Last week</QuickBtn>
          <QuickBtn active={date === isoDaysAgo(14)} onClick={() => setDate(isoDaysAgo(14))}>2 weeks ago</QuickBtn>
          <QuickBtn active={date === isoDaysAgo(21)} onClick={() => setDate(isoDaysAgo(21))}>3 weeks ago</QuickBtn>
        </div>
      </div>

      <MeterStatusTable week="last" date={date} />
    </div>
  );
}

function QuickBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`px-2.5 py-1.5 rounded-full text-xs font-medium border transition ${active ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'}`}>
      {children}
    </button>
  );
}
