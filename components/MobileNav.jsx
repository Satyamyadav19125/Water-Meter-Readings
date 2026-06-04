'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Pending', icon: '📅' },
  { href: '/submissions', label: 'Submissions', icon: '📋' },
  { href: '/usage', label: 'Usage', icon: '💧' },
  { href: '/kobo-view', label: 'Kobo View', icon: '🪞' },
  { href: '/assignments', label: 'Assignments', icon: '👥' },
];

export default function MobileNav({ user }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isAdmin = user?.role === 'admin';
  const isUser = user?.role === 'user';
  const loggedIn = !!user;

  const badge = isAdmin ? 'Admin ✓' : isUser ? user.name : null;

  return (
    <>
      <header className="bg-gradient-to-r from-brand-900 to-brand-700 text-white sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 font-semibold text-base flex-1 min-w-0">
            <span className="text-xl">💧</span>
            <span className="truncate">Water Meter Dashboard</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 text-sm">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded transition ${pathname === l.href ? 'bg-white/20' : 'hover:bg-white/10'}`}
              >
                {l.label}
              </Link>
            ))}
            {loggedIn ? (
              <button onClick={doLogout} className="px-3 py-1.5 rounded bg-emerald-500/30 hover:bg-emerald-500/50 text-sm">
                {badge}
              </button>
            ) : (
              <Link href="/login" className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20">Login</Link>
            )}
          </nav>

          <button
            className="md:hidden p-2 -mr-2 rounded hover:bg-white/10"
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
        <div className="md:hidden fixed inset-0 z-20 bg-black/40" onClick={() => setOpen(false)}>
          <div className="absolute top-14 right-0 w-64 bg-white shadow-xl rounded-bl-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <nav className="flex flex-col">
              {loggedIn && (
                <div className="px-4 py-2 bg-brand-50 text-brand-900 text-xs border-b">
                  Logged in as <strong>{badge}</strong>
                </div>
              )}
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
              <div className="p-3 bg-slate-50">
                {loggedIn ? (
                  <button onClick={doLogout} className="w-full px-3 py-2 rounded bg-emerald-100 text-emerald-900 text-sm">
                    Logout
                  </button>
                ) : (
                  <Link href="/login" onClick={() => setOpen(false)} className="block text-center w-full px-3 py-2 rounded bg-brand-600 text-white text-sm">
                    Login
                  </Link>
                )}
              </div>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

async function doLogout() {
  await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'logout' }),
  });
  window.location.href = '/';
}
