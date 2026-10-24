import type { ProductType } from '../domain/product-types';

/**
 * Is a listing in its own category (founder, 2026-10-24: "everything in its category, not shown in someone else's")?
 * The sourcing runner files a listing under its target's category (worker_sourcing_add), so a search for a masala that
 * also found a chutney filed the chutney under Masala blends, and a sweets search before Raksha Bandhan filed rakhis
 * under Sweets. These rules read a listing's own name and answer only when it is plain: each category has words that
 * name it outright and words that mean something else ("masala cashew" is a snack, "laddu gopal" is Krishna, "jaggery
 * balls" are a sweet). A name that fits its own category, two categories or none is left alone. Pure, no I/O.
 */

interface Rule {
  /** The name says this category outright. */
  is: RegExp;
  /** …unless it also says one of these (then it is something else that carries the word). */
  not?: RegExp;
}

const FOOD: Record<string, Rule> = {
  'pickles-and-chutneys': {
    is: /\b(pickles?|achaa?r|aachar|chutneys?|chutni|thokku|kasundi|thecha|avakaya|murabba)\b/,
    not: /\b(achaa?r|pickle)\b.*\bmasala\b|\bmasala for pickles?\b|\b(achaari|thepla|flavou?r(ed)?)\b/,
  },
  'tea-and-drinks': {
    is: /\b(kahwa|kehwa|green tea|tea bags?|tea leaves|leaf tea|chai patti|filter coffee|instant coffee|coffee (powder|beans)|sharbat|sherbet|squash|thandai)\b/,
    not: /\btea[ -]?time\b|\b(mukhwas|garnish(es)?|dehydrated)\b|\bmouth fresh/,
  },
  'papad-and-wadi': {
    is: /\b(papads?|papadums?|appalam|fryums?|mangodi|wadiyan|wadi|vadiyalu|sandige|kachri|kachari|bori)\b/,
    not: /\baam papad\b|\bpapad (churan|mukhwas)\b|\bmouth fresh/,
  },
  sweets: {
    is: /\b(ladd?oo?s?|laddus?|barfi|burfi|halwa|pedas?|pedha|soan ?papdi|rasgullas?|gulab jamun|chikki|gajak|rewari|rewri|revdi|petha|mysore pak|kaju katli|toffees?|candy|candies|lollipops?|jalebi|pinni|thekua|ghevar|balushahi|chocolates?)\b/,
    not: /\bchocolate (biscuits?|cookies|wafers?)\b|\b(cereal|chocos|candles?|gopal|drink|coffee|flour|combo)\b|\bfor (sweets|ladd?oo?s?|laddus?)\b/,
  },
  'snacks-and-namkeen': {
    is: /\b(namkeen|bhujia|chakli|chakri|murukku|muruku|mathri|khakhra|chivda|chiwda|chevdo|farsan|gathiya|kurkure|nachos|popcorn|biscuits?|cookies|kachori|bhakarwadi|fulwadi|phoolwadi|dalmoth|daalmoth|nimki|namak ?para)\b/,
    not: /\b(mukhwas|ready to fry)\b|\bmouth fresh|\bpoha for\b/,
  },
  'masala-blends': {
    is: /\b(garam masala|chaat masala|sambar powder|rasam powder|curry powder|biryani masala|chole masala|pav bhaji masala|kitchen king|meat masala|chicken masala|fish (curry )?masala|sabzi masala)\b/,
    not: /\b(whole|sabut|khada) garam masala\b|\bgaram masala (whole|sabut)\b|\bwhole spices?\b|\bcombo\b/,
  },
  'ground-spices': {
    is: /\b(turmeric|haldi|chill?i|mirch|coriander|dhaniya|dhania|jeera|cumin|amchur|ginger|sonth|sunth|black pepper|garlic|onion) powder\b/,
    // a combo of several, a podi (a chutney powder) or a blend stays where it is
    not: /\b(combo|each|podi|chutney|masala)\b|,|&| and /,
  },
  'whole-spices': {
    is: /\b(cardamom|elaichi|cloves?|laung|bay lea(f|ves)|tej ?patta|cinnamon|dalchini|star anise|nutmeg|jaiphal|javitri|kalonji|ajwain|peppercorns?|saffron|kesar|(fennel|cumin|mustard|methi|fenugreek|carom|nigella) seeds?|(whole|sabut|khada) garam masala|garam masala (whole|sabut))\b/,
    not: /\b(powder|mukhwas|sprinkles?|blend|kahwa|tea|chai|peda|barfi|camphor|dhoop|oil|drink|sev|nankhatai|sweets?|rusks?|crackers|khurma|til ?patti|tilpatti|khaja)\b|\bmouth fresh/,
  },
  'rice-flours-and-staples': {
    is: /\b(basmati|poha|chuda|atta|besan|sooji|suji|rava|dalia|daliya|khichdi|sattu|(cold[ -]pressed|mustard|sesame|groundnut|coconut) oil|palm jaggery|jaggery (powder|block|cubes)|gur bheli|sushi rice|sticky rice)\b/,
    not: /\b(cakes?|crackers?|bites|balls|bars?|chips|murukk?u|ariselu|anarsa|puth?arekulu|pootharekulu|rewri|rewadi|mukhwas|roasted|wax|drink|mix|para|ladd?oo?|laddu|barfi|halwa|chikki|namkeen|hair|papdi|mixture|rusks?|khichdi masala)\b/,
  },
};

const HOME: Record<string, Rule> = {
  'pooja-and-spiritual': {
    is: /\b(agarbatti|incense|dhoop|sambrani|camphor|kapoor|havan|hawan|rudraksh|rudraksha|janeu|aarti|kalash|chowki|gangajal|poshak|singhasan)\b/,
    not: /\b(candles?|decor|decorative|wall|hanging|stickers?|stencils?|rangoli)\b/,
  },
  'thaali-and-serveware': {
    is: /\b(dinner set|plates?|tumblers?|katori|kadai|kadhai|cooker|tawa|lunch ?box|tiffin|water bottles?|casserole|cutlery|spoons?|ladles?)\b/,
    not: /\b(decor|decorative|decoration|candles?|tea ?light|urli|wall|hanging|showpiece|diya|idol|murti|gopal|god|goddess|pooja|puja|aarti|bhog|deity|mirrors?|yantra|yantram)\b/,
  },
};

/** Things that are not the listing's type at all. Each says why, for the admin who decides (another type, or archive). */
const NOT_TYPE: Partial<Record<ProductType, { is: RegExp; not?: RegExp; reason: string }[]>> = {
  food: [
    { is: /\b(dogs?|puppy|puppies|pets?|cat food)\b/, not: /\bpet (jar|bottle|container|pack)\b/, reason: 'pet food or a pet treat' },
    {
      is: /\b(hair oil|shampoo|conditioner|soap|face ?wash|body wash|lotion|toothpaste|detergent|dishwash|hot wax|wax strips?)\b/,
      reason: 'a toiletry, not food',
    },
    { is: /\brakhis?\b/, reason: 'comes with a rakhi: a Raksha Bandhan gift' },
    { is: /\b(agarbatti|incense|dhoop|camphor)\b/, reason: 'a pooja item, not food' },
    { is: /\b(toilet|tissues?)\b/, reason: 'a household paper, not food' },
  ],
  home: [
    {
      is: /\b(mysore pak|namkeen|bhujia|pickles?|achaa?r|ladd?oo?s?|laddus?|barfi|chocolates?)\b/,
      // Laddu Gopal is Krishna; mithai-shaped candles and candy jars are home
      not: /\b(gopal|candles?|jars?|krishna|kanha|poshak|idol|murti|bhog|statue|showpiece)\b/,
      reason: 'food, not home & gifts',
    },
  ],
};

export type CategoryCheck =
  | { kind: 'ok' }
  /** Another category of the same type reads plainly from the name. */
  | { kind: 'move'; to: string }
  /** Not this product type at all. */
  | { kind: 'not_type'; reason: string };

const clean = (name: string): string => name.toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ');
const says = (rule: Rule, text: string): boolean => rule.is.test(text) && !rule.not?.test(text);

/** Why a name is not of the listing's product type at all, or null. */
export function notOfType(name: string, productType: ProductType): string | null {
  const text = clean(name);
  return NOT_TYPE[productType]?.find((r) => r.is.test(text) && !r.not?.test(text))?.reason ?? null;
}

/** Whether a listing named `name` belongs where it is (`categorySlug` of `productType`). Clothing is not checked. */
export function checkCategory(name: string, productType: ProductType, categorySlug: string): CategoryCheck {
  const reason = notOfType(name, productType);
  if (reason) return { kind: 'not_type', reason };
  const rules = productType === 'food' ? FOOD : productType === 'home' ? HOME : {};
  const text = clean(name);
  if (rules[categorySlug] && says(rules[categorySlug], text)) return { kind: 'ok' };
  const fits = Object.keys(rules).filter((slug) => says(rules[slug]!, text));
  return fits.length === 1 && fits[0] !== categorySlug ? { kind: 'move', to: fits[0]! } : { kind: 'ok' };
}
