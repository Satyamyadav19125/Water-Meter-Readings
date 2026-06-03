'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      window.location.href = '/assignments';
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-12">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🔒</div>
          <h1 className="text-xl font-semibold">Admin Login</h1>
          <p className="text-sm text-slate-500 mt-1">Enter the admin password to manage assignments</p>
        </div>
        <div className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit(e)}
            placeholder="Admin password"
            className="w-full px-3 py-2 border border-slate-300 rounded"
            autoFocus
          />
          {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}
          <button
            onClick={submit}
            disabled={loading || !password}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white font-medium py-2 rounded"
          >
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </div>
      </div>
    </div>
  );
}
