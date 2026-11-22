/** D-203: a kadai with three wisps of steam, the Cook at home drawing where no dish photo is set yet. */
export function KadaiArt({ className = '' }: { className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 120 100" aria-hidden="true" className={`fill-none stroke-current ${className}`} strokeWidth={3} strokeLinecap="round">
      <path d="M44 30c-5-6 5-10 0-17M60 28c-5-6 5-10 0-17M76 30c-5-6 5-10 0-17" />
      <path d="M14 48h92c0 22-20 38-46 38S14 70 14 48z" />
      <path d="M14 52c-6 0-9-3-9-6M106 52c6 0 9-3 9-6" />
      <path d="M44 86l-4 8h40l-4-8" />
    </svg>
  );
}
