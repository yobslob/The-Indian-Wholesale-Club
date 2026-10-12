/**
 * The add-to-bag flight (D-116): a small round copy of the piece's photo (or a brand dot) arcs from the button that
 * added it to the header's bag icon, which then gives a short bounce. Web Animations only, no library; nothing runs
 * for reduced motion or when the bag icon is off screen. Purely decorative: the bag count and its live text still
 * say what happened.
 */
export function flyToBag(from: Element | null, imageUrl?: string | null): void {
  if (!from || typeof window === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const bag = document.querySelector<HTMLElement>('a[aria-controls="bag-panel"]');
  const b = bag?.getBoundingClientRect();
  if (!bag || !b || b.width === 0 || b.bottom < 0) return;
  const a = from.getBoundingClientRect();

  const size = 44;
  const x0 = a.left + a.width / 2 - size / 2;
  const y0 = a.top + a.height / 2 - size / 2;
  const dx = b.left + b.width / 2 - size / 2 - x0;
  const dy = b.top + b.height / 2 - size / 2 - y0;
  // The arc's top: well above both ends, so the piece is "tossed" into the bag.
  const lift = Math.min(-60, dy * 0.25 - 90);

  const dot = document.createElement('span');
  dot.setAttribute('aria-hidden', 'true');
  Object.assign(dot.style, {
    position: 'fixed',
    left: `${x0}px`,
    top: `${y0}px`,
    width: `${size}px`,
    height: `${size}px`,
    zIndex: '80',
    borderRadius: '999px',
    pointerEvents: 'none',
    background: imageUrl ? `center / cover no-repeat url("${imageUrl}"), var(--land)` : 'var(--brand)',
    boxShadow: '0 8px 20px rgb(30 27 22 / 0.28), 0 0 0 2px var(--paper)',
  });
  document.body.appendChild(dot);
  const flight = dot.animate(
    [
      { transform: 'translate(0, 0) scale(0.6)', opacity: 0 },
      { transform: 'translate(0, -8px) scale(1.05)', opacity: 1, offset: 0.12 },
      { transform: `translate(${dx * 0.55}px, ${dy * 0.55 + lift}px) scale(0.8)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.22)`, opacity: 0.4 },
    ],
    { duration: 820, easing: 'cubic-bezier(0.45, 0, 0.25, 1)' },
  );
  flight.onfinish = flight.oncancel = () => {
    dot.remove();
    bag.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.2) rotate(-6deg)' }, { transform: 'scale(0.96)' }, { transform: 'scale(1)' }],
      { duration: 480, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
    );
  };
}
