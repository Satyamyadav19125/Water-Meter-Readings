'use client';

import { useEffect, useState } from 'react';
import MeterStatusTable from '@/components/MeterStatusTable';

export default function MissedPage() {
  const [user, setUser] = useState(undefined); // undefined = loading

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
        <h2 className="text-xl font-semibold">📌 Missed last week</h2>
        <p className="text-sm text-slate-500">
          {user.role === 'admin'
            ? 'Every meter that was NOT read twice during last week, grouped by village.'
            : 'Meters in your villages that were not read twice last week.'}
        </p>
      </div>
      <MeterStatusTable week="last" />
    </div>
  );
}
