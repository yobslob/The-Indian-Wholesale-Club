'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Cook mode (plan §4.3): keeps the screen on while the method is open (the Screen Wake Lock API). Hidden where the
 * browser has no wake lock. The lock is let go when the page is hidden and taken again when it comes back.
 */
export function CookMode(): React.JSX.Element | null {
  const [supported, setSupported] = useState(false);
  const [on, setOn] = useState(false);
  const lock = useRef<WakeLockSentinel | null>(null);

  useEffect(() => setSupported('wakeLock' in navigator), []);

  useEffect(() => {
    if (!on) return;
    let alive = true;
    const take = async (): Promise<void> => {
      try {
        const l = await navigator.wakeLock.request('screen');
        if (!alive) return void l.release();
        lock.current = l;
      } catch {
        setOn(false);
      }
    };
    const back = (): void => {
      if (document.visibilityState === 'visible') void take();
    };
    void take();
    document.addEventListener('visibilitychange', back);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', back);
      void lock.current?.release();
      lock.current = null;
    };
  }, [on]);

  if (!supported) return null;
  return (
    <label className="font-ui inline-flex min-h-11 cursor-pointer items-center gap-2 text-[14px] font-medium">
      <input type="checkbox" role="switch" className="accent-brand size-5" checked={on} onChange={(e) => setOn(e.target.checked)} />
      Cook mode <span className="text-ink-muted font-normal">(keeps the screen on)</span>
    </label>
  );
}
