'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

// iOS-style screen transition. On every route change we replay an "enter"
// animation (fade + lift + subtle scale) on the page content, like a view being
// pushed/presented in an iOS app. Honors prefers-reduced-motion via CSS.
export default function PageTransition({ children }) {
  const pathname = usePathname();
  const [stage, setStage] = useState('in');
  const prev = useRef(pathname);

  useEffect(() => {
    if (prev.current === pathname) return;
    prev.current = pathname;
    // Brief "leaving" state, then swap to the new content entering — reads as a
    // quick close/open, the way an iOS screen dismisses and the next presents.
    setStage('out');
    const t = setTimeout(() => setStage('in'), 120);
    return () => clearTimeout(t);
  }, [pathname]);

  return (
    <div key={pathname} className={stage === 'out' ? 'page-leave' : 'page-enter'}>
      {children}
    </div>
  );
}
