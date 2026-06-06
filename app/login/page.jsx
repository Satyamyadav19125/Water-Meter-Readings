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
      window.location.href = '/';
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-8">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-semibold mb-1">Log in</h1>
        <p className="text-sm text-slate-500 mb-6">Just enter your password — we'll figure out who you are.</p>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">Password</label>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-2 text-sm text-red-800">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-brand-600 text-white py-2.5 rounded font-medium hover:bg-brand-700 disabled:bg-slate-300"
          >
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <p className="text-xs text-slate-400 mt-4 text-center">
          Admin password gives full access. Surveyor passwords give access to their assigned villages only.
        </p>
      </div>
    </div>
  );
}
