'use client';

import { useEffect, useState } from 'react';

import styles from './filters.module.css';

const STEPS = 1000;

/**
 * The price filter's two-handle slider (D-136): whole dollars between the cheapest and the dearest piece shown. It
 * moves freely and applies once a handle is let go (or after a key press), so dragging reads the database once. The
 * scale is squared: most pieces are cheap and a few are dear, so the low prices get most of the track.
 */
export function PriceSlider({
  bounds,
  min,
  max,
  onCommit,
}: {
  bounds: { min: number; max: number };
  min?: number;
  max?: number;
  onCommit: (min: number | undefined, max: number | undefined) => void;
}): React.JSX.Element {
  const [lo, setLo] = useState(min ?? bounds.min);
  const [hi, setHi] = useState(max ?? bounds.max);
  useEffect(() => {
    setLo(Math.max(bounds.min, Math.min(min ?? bounds.min, bounds.max)));
    setHi(Math.min(bounds.max, Math.max(max ?? bounds.max, bounds.min)));
  }, [bounds.min, bounds.max, min, max]);

  const commit = (): void => {
    const nextMin = lo <= bounds.min ? undefined : lo;
    const nextMax = hi >= bounds.max ? undefined : hi;
    if (nextMin !== min || nextMax !== max) onCommit(nextMin, nextMax);
  };
  const span = Math.max(1, bounds.max - bounds.min);
  const toStep = (d: number): number => Math.round(Math.sqrt(Math.max(0, d - bounds.min) / span) * STEPS);
  const fromStep = (p: number): number => Math.round(bounds.min + span * (p / STEPS) ** 2);
  const left = (toStep(lo) / STEPS) * 100;
  const right = (toStep(hi) / STEPS) * 100;
  const events = { onPointerUp: commit, onKeyUp: commit, onTouchEnd: commit };

  return (
    <div className={styles.slider}>
      <p className={styles.range} aria-live="polite">
        ${lo} – ${hi}
        {hi >= bounds.max ? '+' : ''}
      </p>
      <div className={styles.track}>
        <span style={{ left: `${left}%`, right: `${100 - right}%` }} />
        <input
          type="range"
          aria-label="Lowest price"
          aria-valuetext={`$${lo}`}
          min={0}
          max={STEPS}
          value={toStep(lo)}
          onChange={(e) => setLo(Math.min(fromStep(Number(e.target.value)), hi - 1))}
          {...events}
        />
        <input
          type="range"
          aria-label="Highest price"
          aria-valuetext={`$${hi}`}
          min={0}
          max={STEPS}
          value={toStep(hi)}
          onChange={(e) => setHi(Math.max(fromStep(Number(e.target.value)), lo + 1))}
          {...events}
        />
      </div>
    </div>
  );
}
