'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
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
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      window.location.href = '/';
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
          <h1 className="text-xl font-semibold">Login</h1>
          <p className="text-sm text-slate-500 mt-1">Surveyors: enter your name + password</p>
          <p className="text-xs text-slate-400 mt-1">Admin: leave name blank, use admin password</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs text-slate-500">Your name</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. Gaurav (or blank for admin)"
              className="w-full px-3 py-2 border border-slate-300 rounded mt-1"
              autoFocus
              autoComplete="username"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-3 py-2 border border-slate-300 rounded mt-1"
              autoComplete="current-password"
            />
          </div>
          {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white font-medium py-2 rounded"
          >
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>
      </div>
    </div>
  );
}
