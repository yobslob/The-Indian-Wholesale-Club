const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  rupee: '₹',
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const n =
        code[1]?.toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/** Shop HTML (a description, a details block) as plain text: paragraphs and list items on their own lines. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<li(\s[^>]*)?>/gi, '\n• ')
      .replace(/<\/(p|div|li|ul|ol|h[1-6]|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** One line of whitespace-collapsed text. */
export const oneLine = (text: string): string => decodeEntities(text).replace(/\s+/g, ' ').trim();

/**
 * A rupee amount in paise from what shops print: "₹1,299.00", "Rs. 1,299", "1299", 1299. Null when there is no
 * plausible amount (0, negative, or more than ₹10 lakh).
 */
export function parseRupeesToPaise(value: unknown): number | null {
  if (typeof value === 'number')
    return Number.isFinite(value) && value > 0 && value < 1_000_000
      ? Math.round(value * 100)
      : null;
  if (typeof value !== 'string') return null;
  const match = value.replace(/,/g, '').match(/(\d+(?:\.\d{1,2})?)/);
  return match ? parseRupeesToPaise(Number(match[1])) : null;
}

/** A shelf life such as "12 Months", "180 days", "1 year" in days. */
export function parseShelfLifeDays(text: string): number | null {
  const m = text.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(day|week|month|year|yr)/);
  if (!m) return null;
  const n = Number(m[1]);
  const days = m[2] === 'day' ? n : m[2] === 'week' ? n * 7 : m[2] === 'month' ? n * 30 : n * 365;
  return days > 0 && days <= 3650 ? Math.round(days) : null;
}

/** A weight such as "500 g", "1 kg", "250gm", "1.2 Kilograms" in grams. */
export function parseGrams(text: string): number | null {
  const m = text.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(kg|kilo|g\b|gm|gram)/);
  if (!m) return null;
  const grams = Number(m[1]) * (m[2]!.startsWith('k') ? 1000 : 1);
  return grams > 0 && grams <= 50_000 ? Math.round(grams) : null;
}

/** A name shortened to `max` characters at a word or separator, never mid-word. */
export function shorten(text: string, max: number): string {
  const clean = oneLine(text);
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max + 1);
  const at = Math.max(
    cut.lastIndexOf(' | '),
    cut.lastIndexOf(', '),
    cut.lastIndexOf(' - '),
    cut.lastIndexOf(' ('),
  );
  const end = at > max * 0.5 ? at : cut.lastIndexOf(' ');
  return clean.slice(0, end > 0 ? end : max).replace(/[\s,|(-]+$/, '');
}
