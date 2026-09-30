/**
 * WCAG 2.2 contrast (design.md §Accessibility). A region's accent colour colours text on the page backgrounds,
 * so the admin form refuses one below AA (4.5 : 1) against every background it sits on.
 */
export const AA_TEXT_CONTRAST = 4.5;

const HEX = /^#[0-9A-Fa-f]{6}$/;

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio of two #RRGGBB colours (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  if (!HEX.test(a) || !HEX.test(b)) throw new Error('contrastRatio needs two #RRGGBB colours');
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** The lowest ratio of `color` against each background, and whether it meets AA on all of them. */
export function worstContrast(color: string, backgrounds: string[]): { ratio: number; passes: boolean } {
  const ratio = Math.min(...backgrounds.map((bg) => contrastRatio(color, bg)));
  return { ratio, passes: ratio >= AA_TEXT_CONTRAST };
}
