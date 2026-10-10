/** The vendor screens' pictures (D-103: pictures before words). Plain strokes, inherit the text colour. */
const PATHS = {
  camera: 'M4 8h3l2-3h6l2 3h3v11H4z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  home: 'M3 11l9-8 9 8 M5 9.5V21h14V9.5',
  pieces: 'M8 3l-5 4 3 3 2-1v12h8V9l2 1 3-3-5-4c-1 2-2.5 3-4 3S9 5 8 3z',
  box: 'M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7 M12 11v10',
  rupee: 'M6 4h12 M6 9h12 M9 4c4 0 6 1.5 6 4.5S13 13 9 13h-1l7 8',
  check: 'M5 12l5 5L20 7',
  alert: 'M12 3l10 18H2z M12 10v5 M12 18v.5',
  back: 'M15 5l-7 7 7 7',
  plus: 'M12 5v14 M5 12h14',
  minus: 'M5 12h14',
  out: 'M15 4h4v16h-4 M10 8l-4 4 4 4 M6 12h10',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M3 12h18 M12 3c3 3 3 15 0 18 M12 3c-3 3-3 15 0 18',
  women: 'M12 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M8 21l1.5-6L7 13l3-3h4l3 3-2.5 2 1.5 6',
  men: 'M12 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M8 10h8v6h-2v5h-4v-5H8z',
  kids: 'M12 6a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z M9 12h6v4h-1.5v4h-3v-4H9z',
  anyone: 'M8 4a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z M16 4a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z M5 20v-7h6v7 M13 20v-7h6v7',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = 'h-6 w-6' }: { name: IconName; className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`${className} fill-none stroke-current stroke-[1.7]`}
      strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name]} />
    </svg>
  );
}
