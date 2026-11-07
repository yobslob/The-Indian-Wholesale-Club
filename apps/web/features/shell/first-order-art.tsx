'use client';

import { useEffect, useRef, useState } from 'react';

import { isKnownReturning } from '@/features/cart/offers';
import { useCart } from '@/features/cart/store';

/**
 * The four ads (D-193), drawn here so they cost no image and no request of their own. Each is tight to its drawing: `ax`
 * is where it hangs from, in its own coordinates.
 * Words: the founder's offer, WELCOME10 (features/home/first-order.ts).
 */
const WINE = '#7a2e23';
const GOLD = '#c9962f';
const COIN = '#e3b552';
const INK = '#1e1b16';
const PAPER = '#fbf8f3';
const FUR = '#7a4e2a';
const DARK_FUR = '#5e3b1e';
const FACE = '#e8c9a2';
const SKIN = '#b57a4e';

const PACKET = (() => {
  let top = '';
  let bottom = '';
  for (let i = 0; i <= 10; i++) {
    top += `${i * 4} ${i % 2 ? 0 : 2.5} `;
    bottom = `${i * 4} ${i % 2 ? 35 : 32.5} ${bottom}`;
  }
  return `M${top}L${bottom}Z`;
})();

/** The offer on a paper tag, centred on x. */
function Words({ x, y }: { x: number; y: number }): React.JSX.Element {
  return (
    <>
      <text x={x} y={y} textAnchor="middle" fontSize="13.5" fontWeight={700} fill={WINE}>
        10% OFF
      </text>
      <text x={x} y={y + 12} textAnchor="middle" fontSize="10" fontWeight={500} fill={INK}>
        first order
      </text>
    </>
  );
}

/** A strip of packets from over a kirana counter, one word each. */
function Strip(): React.JSX.Element {
  const packet = (y: number, lines: readonly (readonly [string, number, number])[]): React.JSX.Element => (
    <g transform={`translate(0 ${y})`}>
      <path d={PACKET} fill={WINE} />
      {lines.map(([word, at, size]) => (
        <text key={word} x="20" y={at} textAnchor="middle" fontSize={size} fontWeight={700} fill={COIN}>
          {word}
        </text>
      ))}
    </g>
  );
  return (
    <svg width="40" height="108" viewBox="0 0 40 108" aria-hidden="true">
      <path d="M20-120V3" stroke={INK} strokeWidth="1.5" />
      {packet(1, [['FIRST', 21.5, 10.5]])}
      {packet(37, [['ORDER', 21.5, 10.5]])}
      {packet(73, [
        ['10%', 16, 13],
        ['OFF', 27, 10],
      ])}
    </svg>
  );
}

/** The monkey who ran off with 10% of the bill, hanging by his tail, the bill out to the open side. */
function Monkey(): React.JSX.Element {
  return (
    <svg width="82" height="122" viewBox="0 0 82 122" aria-hidden="true">
      <path d="M64 62C78 52 80 36 72 26 66 18 66 8 68-120" fill="none" stroke={DARK_FUR} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M67 76Q71 86 67 92M53 76Q49 86 53 92" fill="none" stroke={FUR} strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="60" cy="66" rx="11" ry="14" fill={FUR} />
      <ellipse cx="60" cy="69" rx="6.5" ry="9" fill={FACE} />
      <path d="M69 58C76 52 78 44 76 38" fill="none" stroke={FUR} strokeWidth="4" strokeLinecap="round" />
      <circle cx="75.5" cy="35" r="3" fill={FACE} />
      <path d="M50 58C44 64 40 74 39 83" fill="none" stroke={FUR} strokeWidth="4" strokeLinecap="round" />
      <circle cx="46" cy="38" r="5" fill={FUR} />
      <circle cx="74" cy="38" r="5" fill={FUR} />
      <circle cx="46" cy="38" r="2.8" fill={FACE} />
      <circle cx="74" cy="38" r="2.8" fill={FACE} />
      <circle cx="60" cy="37" r="14" fill={FUR} />
      <path d="M63 24l1-3M60 23v-4M57 24l-1-3" stroke={DARK_FUR} strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M60 32C63 28 70 29 70 36 70 39 69 41 68 42 68 47 64 50 60 50 56 50 52 47 52 42 51 41 50 39 50 36 50 29 57 28 60 32Z"
        fill={FACE}
      />
      <g className="foa-blink">
        <circle cx="64.5" cy="37" r="1.8" fill={INK} />
        <circle cx="55.5" cy="37" r="1.8" fill={INK} />
      </g>
      <path d="M55 44Q60 48 65 44" fill="none" stroke={INK} strokeWidth="1.2" strokeLinecap="round" />
      <g transform="translate(0 6)">
        <path d="M66 80H0V110L7 113 14 109 21 113 28 109 35 113 42 109 49 113 56 109 66 112Z" fill={PAPER} stroke={INK} strokeWidth=".8" />
        <Words x={33} y={93} />
        <circle cx="39" cy="79" r="3.2" fill={FACE} />
      </g>
    </svg>
  );
}

/** The aunty who presses a shagun envelope on you and will not take no for an answer. */
function Aunty(): React.JSX.Element {
  return (
    <svg width="146" height="132" viewBox="0 0 146 132" aria-hidden="true">
      <path d="M118-120H138L136 30H120Z" fill={WINE} />
      <path d="M120 28H136" stroke={GOLD} strokeWidth="2.5" />
      <path d="M121 30H135L132.5 82H123.5Z" fill={SKIN} />
      <g className="foa-bangles">
        <rect x="119.5" y="52" width="17" height="3" rx="1.5" fill={GOLD} />
        <rect x="120" y="56.5" width="16" height="3" rx="1.5" fill="#a3281e" />
        <rect x="120.5" y="61" width="15" height="3" rx="1.5" fill={GOLD} />
      </g>
      <g transform="translate(0 6)">
        <rect x="121" y="70" width="14" height="12" rx="5" fill={SKIN} />
        <rect x="80" y="78" width="66" height="48" rx="4" fill={WINE} />
        <path d="M80 82 113 100 146 82" fill="none" stroke={GOLD} strokeWidth="1" />
        <circle cx="113" cy="97" r="11" fill={COIN} stroke={GOLD} />
        <text x="113" y="100.5" textAnchor="middle" fontSize="9.5" fontWeight={700} fill={INK}>
          10%
        </text>
        <text x="113" y="120" textAnchor="middle" fontSize="9" fontWeight={700} fill={COIN}>
          off first order
        </text>
        {[121, 125, 129, 133].map((x) => (
          <g key={x}>
            <rect x={x} y="74" width="4" height="12" rx="2" fill={SKIN} stroke="#8e5a35" strokeWidth=".4" />
            <rect x={x + 0.7} y="83" width="2.6" height="2.8" rx="1.1" fill="#b3261e" />
          </g>
        ))}
        <rect x=".5" y="88.5" width="72" height="20" rx="8" fill={PAPER} stroke={INK} strokeWidth=".8" />
        <text x="36.5" y="102.5" textAnchor="middle" fontSize="10.5" fontWeight={600} fill={INK}>
          Rakh lo, beta!
        </text>
      </g>
    </svg>
  );
}

/** Nimbu-mirchi, the lemon and chillies on every shop door at home, with the offer tied on. */
function Charm(): React.JSX.Element {
  return (
    <svg width="72" height="136" viewBox="0 0 72 136" aria-hidden="true">
      <path d="M36-120V98" stroke={INK} strokeWidth="1.2" />
      <g transform="translate(0 44)">
        {/* three chillies, curved and apart: a close fan under a lemon read as a pineapple */}
        <path d="M36 21 31 28M36 21 41 28" stroke="#1f5a26" strokeWidth="1.2" />
        <path d="M29 27C27 35 22 44 15 50 25 47 32 38 33 28Z" fill="#2f7a34" />
        <path d="M43 27C45 35 50 44 57 50 47 47 40 38 39 28Z" fill="#2f7a34" />
        <path d="M34 27C33 35 34 44 36.5 51 39 44 39 35 38 27Z" fill="#3f8f3f" />
        <ellipse cx="36" cy="11" rx="8.5" ry="10" fill="#e9cf35" stroke="#b09a1e" strokeWidth=".6" />
        <path d="M2 58 36 52 70 58V86Q70 89 67 89H5Q2 89 2 86Z" fill={PAPER} stroke={INK} strokeWidth=".8" />
        <Words x={36} y={73} />
      </g>
    </svg>
  );
}

interface Ad {
  Art: () => React.JSX.Element;
  ax: number;
  kind: string;
}

const CHARM: Ad = { Art: Charm, ax: 36, kind: 'foa-sway' };
const STRIP: Ad = { Art: Strip, ax: 20, kind: 'foa-sway' };
const AUNTY: Ad = { Art: Aunty, ax: 128, kind: 'foa-insist' };
const MONKEY: Ad = { Art: Monkey, ax: 68, kind: 'foa-sway' };

/** The founder's Home, then one per type's page. */
const BY_PAGE: Record<string, Ad> = { '/': CHARM, '/food': STRIP, '/clothing': AUNTY, '/home-and-gifts': MONKEY };
const ALL = [STRIP, CHARM, MONKEY, AUNTY];

/** The page's own ad; any other page one by its address. A very small phone gets the narrowest, except on Home. */
function adFor(path: string): Ad {
  if (path !== '/' && window.innerWidth < 360) return STRIP;
  const own = BY_PAGE[path];
  if (own) return own;
  let n = 0;
  for (const c of path) n = (n + c.charCodeAt(0)) % ALL.length;
  return ALL[n]!;
}

const RISE_MS = 280;
/** A finger or pointer this far from where it landed, in any direction, is a swipe. */
const SWIPE_PX = 8;

export function FirstOrderArt({ path }: { path: string }): React.JSX.Element | null {
  const applied = useCart((s) => s.promoCode) === 'WELCOME10';
  const [phase, setPhase] = useState<'down' | 'up' | 'gone'>('down');
  const pressed = useRef<{ x: number; y: number } | null>(null);
  const hide = (): void => {
    pressed.current = null;
    setPhase('up');
  };

  useEffect(() => {
    if (phase !== 'up') return;
    const timer = window.setTimeout(() => setPhase('gone'), RISE_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // Someone with a paid order, or with the coupon on already, has nothing to learn from it.
  if (phase === 'gone' || applied || isKnownReturning()) return null;
  const ad = adFor(path);
  const { Art } = ad;
  return (
    <div className="foa font-ui">
      <button
        type="button"
        aria-label="10% off your first order. Tap to hide."
        className={`foa-ad ${ad.kind}`}
        data-up={phase === 'up' ? '' : undefined}
        style={{ '--ax': `${ad.ax}px` } as React.CSSProperties}
        onClick={hide}
        onPointerDown={(e) => {
          pressed.current = { x: e.clientX, y: e.clientY };
          // the finger may leave the drawing while it swipes
          (e.target as Element).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const from = pressed.current;
          if (from && Math.hypot(e.clientX - from.x, e.clientY - from.y) >= SWIPE_PX) hide();
        }}
        onPointerUp={() => {
          pressed.current = null;
        }}
        onPointerCancel={() => {
          if (pressed.current) hide();
        }}
      >
        <Art />
      </button>
    </div>
  );
}
