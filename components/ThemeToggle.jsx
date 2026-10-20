'use client';

import { useEffect, useState } from 'react';

// Three themes, cycled in order: Light → Dark → Liquid Glass. The choice is
// remembered on this device (localStorage 'wmd-theme'). Light/Dark use the
// `dark` class remap in globals.css; Glass adds the `glass` class (frosted,
// translucent surfaces over an animated gradient).
const ORDER = ['light', 'dark', 'glass'];
const META = {
  light: { icon: '🌙', next: 'dark', title: 'Switch to dark mode' },
  dark:  { icon: '🧊', next: 'glass', title: 'Switch to liquid-glass mode' },
  glass: { icon: '☀️', next: 'light', title: 'Switch to light mode' },
};

function apply(theme) {
  const el = document.documentElement;
  el.classList.toggle('dark', theme === 'dark');
  el.classList.toggle('glass', theme === 'glass');
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    let saved = 'light';
    try { saved = localStorage.getItem('wmd-theme') || 'light'; } catch {}
    if (!ORDER.includes(saved)) saved = 'light';
    setTheme(saved);
    apply(saved);
  }, []);

  function cycle() {
    const next = META[theme]?.next || 'light';
    setTheme(next);
    apply(next);
    // A quick "theme ripple" so the switch itself feels animated.
    document.documentElement.classList.add('theme-switching');
    setTimeout(() => document.documentElement.classList.remove('theme-switching'), 450);
    try { localStorage.setItem('wmd-theme', next); } catch {}
  }

  const m = META[theme] || META.light;
  return (
    <button onClick={cycle} title={m.title} aria-label="Toggle theme"
      className="p-2 rounded-full text-base transition-transform duration-300 hover:bg-white/15 hover:scale-110 active:scale-95">
      <span className="inline-block">{m.icon}</span>
    </button>
  );
}
