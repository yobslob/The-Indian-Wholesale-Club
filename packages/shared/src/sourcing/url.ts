/**
 * Source links (D-110): the marketplace page a pilot listing was copied from. Admin-only data; never on a customer
 * surface (D-003).
 */

const LABELS: Record<string, string> = {
  'myntra.com': 'Myntra',
  'amazon.in': 'Amazon India',
  'flipkart.com': 'Flipkart',
  'ajio.com': 'AJIO',
  'nykaa.com': 'Nykaa',
  'nykaafashion.com': 'Nykaa Fashion',
  'meesho.com': 'Meesho',
  'tatacliq.com': 'Tata CLiQ',
  'jiomart.com': 'JioMart',
  'bigbasket.com': 'bigbasket',
  'snapdeal.com': 'Snapdeal',
};

/** The site's host without www. / m. ("myntra.com"), or null for something that is not an http(s) URL. */
export function siteOf(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.hostname.toLowerCase().replace(/^(www|m|dl)\./, '');
  } catch {
    return null;
  }
}

/** "Myntra", "Amazon India", or the host itself for any other shop. */
export function siteLabel(site: string): string {
  return LABELS[site] ?? site;
}

const TRACKING =
  /^(utm_.*|gclid|fbclid|ref|ref_.*|tag|psc|th|smid|spm|srsltid|_encoding|pf_rd_.*|pd_rd_.*|qid|sr|crid|sprefix|keywords|dib|dib_tag|content-id)$/i;

/**
 * One address per product, so capturing the same product twice finds the same listing: Amazon becomes /dp/<ASIN>,
 * Flipkart keeps only its pid, Myntra and every other shop lose the query's tracking and the hash.
 */
export function cleanSourceUrl(url: string): string {
  const u = new URL(url);
  u.hash = '';
  u.protocol = 'https:';
  const site = siteOf(url);
  if (site === 'amazon.in' || site?.startsWith('amazon.')) {
    const asin = u.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i)?.[1];
    if (asin) return `https://www.${site}/dp/${asin.toUpperCase()}`;
  }
  if (site === 'myntra.com') return `https://www.myntra.com${u.pathname.replace(/\/+$/, '')}`;
  if (site === 'flipkart.com') {
    const pid = u.searchParams.get('pid');
    return `https://www.flipkart.com${u.pathname}${pid ? `?pid=${encodeURIComponent(pid)}` : ''}`;
  }
  for (const key of [...u.searchParams.keys()]) if (TRACKING.test(key)) u.searchParams.delete(key);
  return u.toString();
}

/**
 * A public https address the server may fetch (a page or a photo). Refuses IP literals, localhost and private names,
 * so a crafted capture cannot make the server read something inside a network.
 */
export function isPublicHttpsUrl(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443'))
    return false;
  const host = u.hostname.toLowerCase();
  if (
    !host.includes('.') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === 'localhost'
  )
    return false;
  if (/^[\d.]+$/.test(host) || host.startsWith('[') || host.includes(':')) return false;
  return true;
}
