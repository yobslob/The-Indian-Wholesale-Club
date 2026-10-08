/**
 * The info pages as plain blocks (D-092, D-095): one source of their wording for the website (the pages and the glass
 * panel) and the app (the "About us & help" sheet), each drawing them in its own way. No markup, no HTML.
 */

/** A run of text: plain, bold, or a link. `to` is a site path (/faq) or a full address (mailto:, https:). */
export type Inline = string | { strong: string } | { link: string; to: string };

export type Block =
  | { kind: 'h'; text: string }
  | { kind: 'p'; parts: Inline[]; muted?: boolean; small?: boolean }
  | { kind: 'ul' | 'ol'; items: Inline[][] }
  /** Questions and answers that open and close (the FAQ). */
  | { kind: 'qa'; items: { q: string; a: Block[] }[] };

export type InfoSlug = 'about' | 'how-it-works' | 'faq' | 'shipping-returns' | 'contact' | 'privacy' | 'terms';

/** The seven, in the order of the tabs (the website's INFO_LINKS). */
export const INFO_PAGES: { slug: InfoSlug; title: string }[] = [
  { slug: 'about', title: 'About us' },
  { slug: 'how-it-works', title: 'How it works' },
  { slug: 'faq', title: 'FAQ' },
  { slug: 'shipping-returns', title: 'Shipping & returns' },
  { slug: 'contact', title: 'Contact' },
  { slug: 'privacy', title: 'Privacy' },
  { slug: 'terms', title: 'Terms' },
];

export const p = (...parts: Inline[]): Block => ({ kind: 'p', parts });
export const h = (text: string): Block => ({ kind: 'h', text });
export const ul = (...items: Inline[][]): Block => ({ kind: 'ul', items });
