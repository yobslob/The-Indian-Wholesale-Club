/**
 * The recipe photo runner's choices (D-214), kept pure so `pick.test.mjs` can check them: what to search for, and which
 * of Magnific Stock's results is "a good photo" for a dish.
 */

/** Words that say nothing about the dish, left out when matching a result's title. */
const FILLER = new Set(['and', 'with', 'ka', 'ki', 'ke', 'of', 'the', 'a', 'style', 'indian', 'food']);

/** The search words: the recipe's name in the founder's template (`{name}`), default "{name} indian food". */
export function searchTerm(name, template = '{name} indian food') {
  return template.replace('{name}', name).replace(/\s+/g, ' ').trim();
}

/** The name's own words, lower case and without filler: "Aloo Tikki Chaat" → aloo, tikki, chaat. */
export function nameWords(name) {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !FILLER.has(w));
}

/** A word as a whole word of the title or tags, plurals too: "naan" in "naans, bread", never in "naanwala". */
const holds = (title, w) => new RegExp(`(^|[^a-z0-9])${w}(s|es)?([^a-z0-9]|$)`).test(title);

/**
 * A result's score, or 0 when it is not a photo of the dish: its title (or tags) must hold every word of the dish's
 * name. Founder, 2026-11-27: "butter garlic naan and dal makhani photo is wrong": a photo of wild-garlic butter held
 * two of three words, a plate of chana dal one of two. Then: the dish named among its first tags (a photo's main
 * subject comes first), how popular it is, a square or landscape frame (the recipe card is square, the page wide).
 * Anything not a photo, or with people in it, scores less or nothing.
 */
export function score(result, words) {
  const image = result?.image ?? {};
  if (image.type && image.type !== 'photo') return 0;
  const title = String(result?.title ?? '').toLowerCase();
  if (words.length === 0 || !words.every((w) => holds(title, w))) return 0;
  const lead = title.split(',').slice(0, 3).join(',');
  const first = words.filter((w) => holds(lead, w)).length / words.length;
  const downloads = Number(result?.stats?.downloads ?? 0);
  const frame = image.orientation === 'square' ? 0.6 : image.orientation === 'horizontal' ? 0.4 : 0;
  const people = /\b(woman|man|girl|boy|people|person|hands?|chef|family)\b/.test(title) ? 0.5 : 0;
  return 10 + first * 2 + Math.log10(downloads + 1) * 0.6 + frame - people;
}

/** The best result for a dish, or null when none of them is a photo of it; `used`: photo ids another recipe has. */
export function best(results, name, used = new Set()) {
  const words = nameWords(name);
  let top = null;
  let topScore = 0;
  for (const r of results ?? []) {
    if (used.has(String(r.id))) continue;
    const s = score(r, words);
    if (s > topScore) {
      top = r;
      topScore = s;
    }
  }
  return top;
}

/** The licence links a result came with, for the credits file (sources.mjs names them `licences`). */
export function licences(result) {
  return (result?.licences ?? result?.licenses ?? []).map((l) => `${l.type}: ${l.url}`).join(' | ');
}
