import { parseGrams, parseShelfLifeDays } from './text';

import type { SourcedProduct } from './capture';
import type { VariantOptions } from '../domain/listing';
import type { ProductType } from '../domain/product-types';

/**
 * First guesses for the import form (D-110). They only pre-fill it: the admin confirms the state, type and category
 * before anything is saved, because where a piece is made is a fact we never invent (D-004, D-012).
 */

const words = (text: string): string[] =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w));

const TYPE_WORDS: Record<ProductType, string[]> = {
  clothing: [
    'saree',
    'sari',
    'kurta',
    'kurti',
    'kurtas',
    'lehenga',
    'choli',
    'dupatta',
    'stole',
    'shawl',
    'dhoti',
    'mundu',
    'salwar',
    'churidar',
    'anarkali',
    'sherwani',
    'nehru',
    'jacket',
    'shirt',
    'top',
    'tunic',
    'dress',
    'gown',
    'suit',
    'pyjama',
    'palazzo',
    'jutti',
    'mojari',
    'kolhapuri',
    'chappal',
    'sandal',
    'footwear',
    'turban',
    'pagdi',
    'blouse',
    'fabric',
    'apparel',
    'ethnic',
    'kurtis',
    'mekhela',
    'phiran',
  ],
  food: [
    'masala',
    'spice',
    'powder',
    'bhujia',
    'namkeen',
    'mixture',
    'chips',
    'pickle',
    'achar',
    'papad',
    'wadi',
    'sweet',
    'mithai',
    'laddu',
    'barfi',
    'halwa',
    'chikki',
    'tea',
    'chai',
    'coffee',
    'ghee',
    'atta',
    'flour',
    'rice',
    'dal',
    'snack',
    'biscuit',
    'rusk',
    'murukku',
    'chutney',
    'jaggery',
    'gur',
    'honey',
    'saffron',
    'cardamom',
    'pepper',
    'turmeric',
    'haldi',
    'chilli',
    'jeera',
    'hing',
    'garam',
    'food',
    'grocery',
    'gourmet',
    'makhana',
    'poha',
    'sev',
  ],
  home: [
    'brass',
    'copper',
    'idol',
    'murti',
    'diya',
    'pooja',
    'puja',
    'thali',
    'agarbatti',
    'incense',
    'decor',
    'wall',
    'hanging',
    'handicraft',
    'painting',
    'madhubani',
    'warli',
    'pattachitra',
    'lamp',
    'bowl',
    'tumbler',
    'lota',
    'kalash',
    'showpiece',
    'statue',
    'figurine',
    'toran',
    'rangoli',
    'serveware',
  ],
};

export function guessProductType(product: SourcedProduct): ProductType {
  const text = words([product.title, ...product.hints].join(' '));
  let best: ProductType = 'clothing';
  let bestScore = 0;
  for (const [type, list] of Object.entries(TYPE_WORDS) as [ProductType, string[]][]) {
    const set = new Set(list.map((w) => words(w)[0]));
    const score =
      text.filter((w) => set.has(w)).length +
      (product.hints.some((h) => /apparel|footwear|clothing|ethnic/i.test(h)) && type === 'clothing'
        ? 2
        : 0);
    if (score > bestScore) [best, bestScore] = [type, score];
  }
  return best;
}

/** Words that point at a category, beyond its own name (by the category's slug, supabase/seed/categories.sql). */
const CATEGORY_WORDS: Record<string, string[]> = {
  sarees: ['saree', 'sari', 'drape'],
  kurtas: ['kurta', 'kurti', 'tunic'],
  'suits-and-sets': ['salwar', 'churidar', 'anarkali', 'suit', 'set'],
  lehengas: ['lehenga', 'choli', 'ghagra'],
  'dupattas-and-stoles': ['dupatta', 'stole', 'odhni'],
  shawls: ['shawl', 'pashmina'],
  'dhotis-and-mundus': ['dhoti', 'mundu', 'veshti', 'lungi'],
  footwear: ['jutti', 'mojari', 'kolhapuri', 'chappal', 'sandal', 'footwear', 'shoe'],
  headwear: ['turban', 'pagdi', 'cap', 'topi'],
  'whole-spices': ['whole', 'seed', 'cardamom', 'pepper', 'clove', 'cinnamon'],
  'ground-spices': ['powder', 'haldi', 'turmeric', 'chilli'],
  'masala-blends': ['masala', 'garam', 'blend'],
  'pickles-and-chutneys': ['pickle', 'achar', 'chutney'],
  'papad-and-wadi': ['papad', 'wadi', 'wadiyan', 'fryum'],
  'snacks-and-namkeen': [
    'bhujia',
    'namkeen',
    'mixture',
    'chips',
    'sev',
    'murukku',
    'snack',
    'chakli',
  ],
  sweets: ['sweet', 'mithai', 'laddu', 'barfi', 'halwa', 'peda', 'chikki', 'soan'],
  'rice-flours-and-staples': ['rice', 'atta', 'flour', 'dal', 'ghee', 'poha', 'jaggery'],
  'tea-and-drinks': ['tea', 'chai', 'coffee', 'sharbat'],
  'pooja-and-spiritual': [
    'pooja',
    'puja',
    'diya',
    'idol',
    'murti',
    'agarbatti',
    'incense',
    'kalash',
  ],
  'thaali-and-serveware': [
    'thali',
    'thaali',
    'bowl',
    'tumbler',
    'lota',
    'plate',
    'glass',
    'serveware',
  ],
  'handicrafts-and-decor': [
    'decor',
    'painting',
    'hanging',
    'showpiece',
    'statue',
    'figurine',
    'toran',
    'handicraft',
  ],
};

export interface CategoryChoice {
  id: string;
  slug: string;
  name: string;
  product_type: ProductType;
}

/** The category of `type` whose words the product mentions most; the type's first category when none match. */
export function guessCategory(
  product: SourcedProduct,
  type: ProductType,
  categories: CategoryChoice[],
): string | null {
  const ofType = categories.filter((c) => c.product_type === type);
  const text = new Set(words([product.title, ...product.hints].join(' ')));
  let best = ofType[0]?.id ?? null;
  let bestScore = 0;
  for (const c of ofType) {
    const vocabulary = new Set([
      ...words(c.name),
      ...words(c.slug.replace(/-/g, ' ')),
      ...(CATEGORY_WORDS[c.slug] ?? []).flatMap(words),
    ]);
    vocabulary.delete('and');
    const score = [...vocabulary].filter((w) => text.has(w)).length;
    if (score > bestScore) [best, bestScore] = [c.id, score];
  }
  return best;
}

/**
 * Crafts and foods named after the one state that makes them. A product naming one of these gets that state as the
 * first guess; anything else is left for the admin to pick.
 */
const REGION_WORDS: [RegExp, string][] = [
  [/banaras|benaras|varanasi|lucknow|chikan|chikankari|agra petha|mathura peda/i, 'uttar-pradesh'],
  [/kanj[ie]e?varam|kanchipuram|chettinad|madurai|tirunelveli|kovilpatti/i, 'tamil-nadu'],
  [/kasavu|kerala|malabar|alleppey|kuthampully|balaramapuram|banana chips/i, 'kerala'],
  [/mysore|ilkal|udupi|coorg|channapatna|dharwad/i, 'karnataka'],
  [/paithani|kolhapur|puneri|pune|nagpur|nashik|solapur/i, 'maharashtra'],
  [/patola|kutch|kachchh|ajrakh|gujarati|khakhra|surat/i, 'gujarat'],
  [/leheriya|jaipur|bikaner|sanganer|bagru|jodhpur|udaipur|rajasthani|mojari/i, 'rajasthan'],
  [/chanderi|maheshwari|bagh print|ratlami|indori/i, 'madhya-pradesh'],
  [/pochampall?y|gadwal|narayanpet|hyderabad/i, 'telangana'],
  [
    /mangalagiri|uppada|venkatagiri|dharmavaram|kalamkari|guntur|kondapalli|araku/i,
    'andhra-pradesh',
  ],
  [/sambalpuri|bomkai|odisha|pattachitra|kotpad/i, 'odisha'],
  [/baluchari|tant saree|jamdani|darjeeling|bengal|shantipur|rasgulla|sandesh/i, 'west-bengal'],
  [/muga|mekhela|assam/i, 'assam'],
  [/phulkari|amritsar|patiala|punjabi jutti/i, 'punjab'],
  [/kashmir|pashmina|kani|srinagar/i, 'jammu-and-kashmir'],
  [/kullu|kangra|chamba|himachal/i, 'himachal-pradesh'],
  [/madhubani|bhagalpur|bihar|litti/i, 'bihar'],
  [/goan|goa\b/i, 'goa'],
  [/manipur|moirang/i, 'manipur'],
  [/naga\b|nagaland/i, 'nagaland'],
  [/sikkim/i, 'sikkim'],
  [/chandni chowk|old delhi|purani dilli/i, 'delhi'],
];

export function guessRegionSlug(product: SourcedProduct): string | null {
  const text = `${product.title} ${product.hints.join(' ')}`;
  let found: { slug: string; at: number } | null = null;
  for (const [pattern, slug] of REGION_WORDS) {
    const at = text.search(pattern);
    if (at >= 0 && (!found || at < found.at)) found = { slug, at };
  }
  return found?.slug ?? null;
}

const spec = (product: SourcedProduct, pattern: RegExp): string =>
  product.specs.find(([k]) => pattern.test(k))?.[1]?.trim() ?? '';

/** What the form pre-fills for each type's required details (attributes.ts), from the shop's specifications. */
export function guessDetails(product: SourcedProduct) {
  const materialCare = spec(product, /^material\s*&\s*care$/i).split(/;\s*/);
  const ingredientsInText = product.description.match(/ingredients?\s*[:-]\s*([^\n]+)/i)?.[1] ?? '';
  const weightText =
    spec(product, /^(net quantity|net weight|item weight|weight|net qty)/i) || product.title;
  return {
    fibre:
      spec(
        product,
        /^(fabric|material|material composition|top fabric|saree fabric|fabric type)$/i,
      ) ||
      materialCare[0] ||
      '',
    care:
      spec(product, /^(wash care|care instructions?|care)$/i) ||
      materialCare.slice(1).join('; ') ||
      '',
    material: spec(product, /^(material|material type|base material|frame material)$/i),
    ingredients: spec(product, /^ingredients?$/i) || ingredientsInText.trim(),
    allergens: spec(product, /^allergen/i),
    shelfLifeDays: parseShelfLifeDays(spec(product, /shelf life|best before/i)),
    weightG: parseGrams(weightText),
  };
}

const ONE_SIZE = /^(one ?size|onesize|free ?size|freesize|standard|na|n\/a|default title)$/i;

/**
 * The listing's options from the shop's sizes (D-110): each size the shop has becomes an option with `qty` pieces,
 * one it has run out of gets 0. "Free size" and a page without sizes make one "One size" option.
 */
export function sourcedVariants(
  sizes: { label: string; available: boolean }[],
  qty: number,
  weightG: number | null,
  inStock: boolean | null,
): { label: string; options: { size?: string }; qty: number; weight_g?: number }[] {
  const weight = weightG && weightG > 0 ? { weight_g: Math.round(weightG) } : {};
  const real = sizes.filter((s) => !ONE_SIZE.test(s.label.trim()));
  if (real.length === 0) {
    const available = sizes.length ? sizes.some((s) => s.available) : inStock !== false;
    return [{ label: 'One size', options: {}, qty: available ? qty : 0, ...weight }];
  }
  const seen = new Set<string>();
  return real
    .filter(
      (s) => !seen.has(s.label.trim().toLowerCase()) && seen.add(s.label.trim().toLowerCase()),
    )
    .map((s) => ({
      label: s.label.trim().slice(0, 40),
      options: { size: s.label.trim().slice(0, 40) },
      qty: s.available ? qty : 0,
      ...weight,
    }));
}

/**
 * The listing's variants from an imported page (D-118): the page's own items when it shows several (flavours, packs,
 * colours with sizes), each with its own shop price and the shop's id for the weekly check; otherwise its sizes
 * (sourcedVariants). An item the shop has run out of gets 0 pieces.
 */
export function importVariants(
  product: SourcedProduct,
  qty: number,
  weightG: number | null,
): {
  label: string;
  options: VariantOptions;
  qty: number;
  weight_g?: number;
  shop_price_paise?: number;
  source: { key: string; url: string; inStock: boolean; pricePaise: number } | null;
}[] {
  const priced = product.variants.filter((v) => v.pricePaise);
  if (priced.length > 1 || (priced.length === 1 && Object.keys(priced[0]!.options).length > 0)) {
    const seen = new Set<string>();
    return priced
      .filter((v) => !seen.has(v.label.toLowerCase()) && !!seen.add(v.label.toLowerCase()))
      .map((v) => {
        const weight = v.weightG ?? weightG;
        return {
          label: v.label,
          options: v.options,
          qty: v.inStock === false ? 0 : qty,
          ...(weight && weight > 0 ? { weight_g: Math.round(weight) } : {}),
          shop_price_paise: v.pricePaise!,
          source: {
            key: v.key,
            url: v.url,
            inStock: v.inStock !== false,
            pricePaise: v.pricePaise!,
          },
        };
      });
  }
  return sourcedVariants(product.sizes, qty, weightG, product.inStock).map((v) => ({
    ...v,
    source: null,
  }));
}
