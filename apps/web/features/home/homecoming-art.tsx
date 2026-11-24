/**
 * The small drawings of Home's season window (homecoming-windows.tsx): line art in the window's ink, no images, no
 * requests. The season's own is the leaf (Homecoming, D-196). D-204: the arch windows and their drawings left Home.
 */

/** The buttons' arrow, in a hairline ring that fills on hover (D-176). */
export function Arrow(): React.JSX.Element {
  return (
    <span className="hc-go-ring" aria-hidden="true">
      <svg viewBox="0 0 16 16">
        <path d="M3.5 8h9M9 4.5 12.5 8 9 11.5" />
      </svg>
    </span>
  );
}

/** An autumn leaf over the wide window: it drifts down, turning, and fades, again and again. */
export function Leaf({ className }: { className: string }): React.JSX.Element {
  return (
    <svg className={`hc-leaf ${className}`} viewBox="-12 -16 24 34" aria-hidden="true">
      <path d="M0 -14 C8.5 -6 8.5 5 0 13 C-8.5 5 -8.5 -6 0 -14 Z" />
      <path className="hc-leaf-rib" d="M0 -9 V17 M0 -2 L4.5 -6 M0 3 L-4.5 -1" />
    </svg>
  );
}
