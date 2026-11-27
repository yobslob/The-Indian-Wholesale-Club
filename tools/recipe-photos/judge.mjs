/**
 * The GPU picker (D-214, founder 2026-11-27: "scrape high quality tasty looking images"): the laptop's vision model
 * (Ollama, the label reader's qwen3-vl) looks at a recipe's best few results and says whether each is the dish and how
 * appetising and sharp it looks; the runner keeps the best one. Tags and titles only say what a photographer typed:
 * "butter, wild garlic" was taken for Butter Garlic Naan. Pure scoring here (judge.test.mjs); `ask` is the one call.
 */
import { readFileSync } from 'node:fs';

import { nameWords } from './pick.mjs';

export const MODEL = process.env.IWC_PHOTO_MODEL ?? process.env.IWC_LABEL_MODEL ?? 'qwen3-vl:8b-instruct';
const HOST = process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434';

/** What the model answers, as JSON (Ollama's structured output). */
export const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    is_dish: { type: 'boolean' },
    main_subject: { type: 'boolean' },
    appetising: { type: 'integer', minimum: 1, maximum: 10 },
    sharp: { type: 'integer', minimum: 1, maximum: 10 },
    people: { type: 'boolean' },
    text_or_logo: { type: 'boolean' },
    cluttered: { type: 'boolean' },
  },
  required: ['is_dish', 'main_subject', 'appetising', 'sharp', 'people', 'text_or_logo', 'cluttered'],
};

export const prompt = (dish) =>
  `Is this a photo of the Indian dish "${dish}" itself (served, ready to eat, the main subject)? A different dish, ` +
  `raw ingredients, a menu or a packet is not. Is it the main subject, filling most of the frame, rather than one of ` +
  `several dishes on a thali or platter? Rate how appetising it looks (1-10: light, colour, freshness, ` +
  `plating) and how sharp it is (1-10). Are there people, hands or faces anywhere in it, printed ones too? Is there ` +
  `any text, printed paper, packaging, a watermark or a logo anywhere in the frame? Is the background cluttered ` +
  `(books, gadgets, bags, a messy table)? Answer as JSON.`;

/**
 * The lowest score a photo may have (an appetising 7 and sharp 6 with nothing against it is 20): founder, 2026-11-27,
 * "high quality tasty looking images". A recipe whose photos all score less gets none (not-found.txt).
 */
export const MIN_SCORE = 18;
/** A photo this good (appetising 9, sharp 9, nothing against it) is taken without looking further: the GPU's time. */
export const GOOD_ENOUGH = 27;

/**
 * A verdict's score, or 0 when it is not the dish or scores under MIN_SCORE: appetising counts most; people, text, a
 * cluttered background count against; a photo 1,000 px wide or more a little for.
 */
export function verdictScore(v, width = 0) {
  if (!v?.is_dish || v.main_subject === false) return 0;
  const n = (x) => Math.min(10, Math.max(1, Number(x) || 1));
  const s =
    n(v.appetising) * 2 + n(v.sharp) - (v.people ? 3 : 0) - (v.text_or_logo ? 3 : 0) - (v.cluttered ? 3 : 0) +
    (width >= 1000 ? 1 : 0);
  return s >= MIN_SCORE ? s : 0;
}

/**
 * The results worth showing the model, best first: those whose words hold the whole dish name, then those holding at
 * least half of it (the model decides); among equals a title about the dish alone first ("Dal makhani" before
 * "Chicken, Mixed Veg Curries, Dosai, Idli, Uttapam"), then the wider photo; at most `n`.
 */
export function shortlist(results, name, n, used = new Set()) {
  const words = nameWords(name);
  const share = (r) => {
    const t = String(r.title ?? '').toLowerCase();
    return words.length ? words.filter((w) => new RegExp(`(^|[^a-z0-9])${w}(s|es)?([^a-z0-9]|$)`).test(t)).length / words.length : 0;
  };
  // how many more words than the dish's its title has, in steps of three (a title is rarely just the name)
  const focus = (r) => Math.floor(Math.max(0, nameWords(String(r.name ?? r.title ?? '')).length - words.length) / 3);
  return (results ?? [])
    .filter((r) => !used.has(String(r.id)))
    .map((r) => ({ r, s: share(r) }))
    .filter(({ s }) => s >= 0.5)
    .sort((a, b) => b.s - a.s || focus(a.r) - focus(b.r) || (b.r.width ?? 0) - (a.r.width ?? 0))
    .slice(0, n)
    .map(({ r }) => r);
}

/** Whether Ollama is running with the model; a message saying what to do when not. */
export async function ready() {
  try {
    const res = await fetch(`${HOST}/api/tags`, { signal: AbortSignal.timeout(5000) });
    const names = ((await res.json()).models ?? []).map((m) => m.name);
    return names.includes(MODEL) ? null : `Ollama has no ${MODEL}: run  ollama pull ${MODEL}  (or --no-judge).`;
  } catch {
    return `Ollama is not running at ${HOST}: start it (ollama serve) or run with --no-judge.`;
  }
}

/** The model's verdict on one saved photo. */
export async function ask(file, dish) {
  const res = await fetch(`${HOST}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt(dish), images: [readFileSync(file).toString('base64')] }],
      format: VERDICT_SCHEMA,
      stream: false,
      keep_alive: '30m',
      options: { temperature: 0, seed: 7, num_ctx: 6144, num_predict: 120 },
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) throw new Error(`Ollama: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  return JSON.parse((await res.json()).message?.content ?? '{}');
}
