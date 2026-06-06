'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const baseLinks = [
  { href: '/', label: 'Pending', icon: '📅' },
  { href: '/submissions', label: 'Submissions', icon: '📋' },
  { href: '/usage', label: 'Usage', icon: '💧' },
  { href: '/analytics', label: 'Analytics', icon: '📊' },
  { href: '/map', label: 'Map', icon: '🗺️' },
  { href: '/kobo-view', label: 'Kobo View', icon: '🪞' },
  { href: '/assignments', label: 'Assignments', icon: '👥' },
];

export default function MobileNav({ user }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isAdmin = user?.role === 'admin';
  const isUser = user?.role === 'user';
  const loggedIn = !!user;
  const badge = isAdmin ? 'Admin' : isUser ? user.name : null;

  const links = isAdmin ? [...baseLinks, { href: '/debug', label: 'Debug', icon: '🔧' }] : baseLinks;

  return (
    <>
      <header className="bg-gradient-to-r from-brand-900 to-brand-700 text-white sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 font-semibold text-base flex-1 min-w-0">
            <span className="text-xl">💧</span>
            <span className="truncate">Water Meter Dashboard</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1 text-sm">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`px-2.5 py-1.5 rounded transition ${pathname === l.href ? 'bg-white/20' : 'hover:bg-white/10'}`}
              >
                {l.label}
              </Link>
            ))}
            {loggedIn ? (
              <button
                onClick={doLogout}
                title={`Logged in as ${badge} — click to log out`}
                className="ml-2 px-3 py-1.5 rounded bg-emerald-500/30 hover:bg-red-500/50 text-sm flex items-center gap-1 transition group"
              >
                <span>{badge}</span>
                <span className="text-xs opacity-70 group-hover:opacity-100">· Log out</span>
              </button>
            ) : (
              <Link href="/login" className="ml-2 px-3 py-1.5 rounded bg-white/10 hover:bg-white/20">Login</Link>
            )}
          </nav>

          <button
            className="lg:hidden p-2 -mr-2 rounded hover:bg-white/10"
            onClick={() => setOpen(!open)}
            aria-label="Menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {open ? <path d="M6 18L18 6M6 6l12 12"/> : <path d="M3 6h18M3 12h18M3 18h18"/>}
            </svg>
          </button>
        </div>
      </header>

      {open && (
        <div className="lg:hidden fixed inset-0 z-20 bg-black/40" onClick={() => setOpen(false)}>
          <div className="absolute top-14 right-0 w-72 bg-white shadow-xl rounded-bl-lg overflow-hidden max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {loggedIn && (
              <div className="px-4 py-3 bg-brand-50 text-brand-900 text-sm border-b flex items-center justify-between">
                <div>
                  Logged in as <strong>{badge}</strong>
                </div>
                <button
                  onClick={doLogout}
                  className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded font-medium hover:bg-red-200"
                >
                  Log out
                </button>
              </div>
            )}
            <nav className="flex flex-col">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`px-4 py-3 border-b border-slate-100 flex items-center gap-3 ${pathname === l.href ? 'bg-brand-50 text-brand-900 font-medium' : ''}`}
                >
                  <span>{l.icon}</span>
                  <span>{l.label}</span>
                </Link>
              ))}
              {!loggedIn && (
                <div className="p-3 bg-slate-50">
                  <Link href="/login" onClick={() => setOpen(false)} className="block text-center w-full px-3 py-2 rounded bg-brand-600 text-white text-sm font-medium">Login</Link>
                </div>
              )}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

async function doLogout() {
  if (!confirm('Log out?')) return;
  await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'logout' }),
  });
  window.location.href = '/login';
}
