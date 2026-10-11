/**
 * The master catalogue's rows as listings (D-106 – D-108): catalogue/master/products.csv → one listing per item, with
 * its category, its options (the catalogue's placeholder sets) and a placeholder shop price. Pure: no database.
 */
import { createHash } from 'node:crypto';

import { COLOURS, PACKS, SIZES } from '../../catalogue/data/sets.mjs';

export const FILE_CATEGORY = {
  'Handloom & Textiles': 'textiles',
  'Regional Footwear': 'footwear',
  'Accessories & Adornments': 'accessories',
  'Fooding & Delicacies': 'food',
  'Pooja & Spiritual Items': 'pooja-and-spiritual',
  'Thaali & Traditional Serveware': 'thaali-and-serveware',
  'Handicrafts & Decor': 'handicrafts-and-decor',
};
const TOP = 'Top 10 Most Ordered';

// DEV PLACEHOLDER shop prices in rupees, by category, used where the file has no range (D-012, D-108).
const RUPEES = {
  sarees: [1500, 6000], lehengas: [3000, 9000], 'dupattas-and-stoles': [500, 2000], shawls: [1200, 5000],
  kurtas: [600, 1800], 'suits-and-sets': [1200, 3500], 'dhotis-and-mundus': [400, 1200], 'jackets-and-knitwear': [1200, 3500],
  headwear: [300, 1000], 'shirts-and-tops': [500, 1500], fabrics: [500, 2000], footwear: [600, 2000], accessories: [300, 2500],
  'whole-spices': [150, 400], 'ground-spices': [120, 350], 'masala-blends': [150, 400], 'pickles-and-chutneys': [200, 500],
  'papad-and-wadi': [150, 350], 'snacks-and-namkeen': [150, 400], sweets: [300, 800], 'rice-flours-and-staples': [200, 600],
  'tea-and-drinks': [250, 700], 'pooja-and-spiritual': [250, 1500], 'thaali-and-serveware': [800, 3500],
  'handicrafts-and-decor': [600, 3000],
};
const PACK_STEP = [1, 1.8, 3.2]; // the 2nd and 3rd pack's shop price against the first (as scripts/build-catalogue.mjs)

const has = (text, words) => new RegExp(`\\b(${words})`, 'i').test(text);
export const hash = (s) => createHash('sha256').update(s).digest().readUInt32BE(0);
export const slugify = (s) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70).replace(/-+$/, '');

/** Category slug, product type and options for one item of the file's category. */
export function classify(kind, name) {
  const free = SIZES.free;
  if (kind === 'textiles') {
    if (has(name, 'runner|table mat|placemat|coaster|cushion|curtain|bed ?sheet|bedspread|bed spread|towel|napkin|rug|durrie|dhurrie|carpet|dining|wall hanging'))
      return { type: 'home', category: 'handicrafts-and-decor' };
    if (has(name, 'sari|saree|mekhela|nauvari|kasavu|paithani')) return { type: 'clothing', category: 'sarees', colours: COLOURS.sareeFestive, sizes: free };
    if (has(name, 'lehenga|ghagra|chaniya')) return { type: 'clothing', category: 'lehengas', colours: COLOURS.lehenga, sizes: SIZES.adult };
    if (has(name, 'shawl|pashmina|chadd?ar|blanket|throw|khes|lohi|pattu')) return { type: 'clothing', category: 'shawls', colours: COLOURS.shawl, sizes: free };
    if (has(name, 'dupatta|odhni|stole|scarf|scarves|muffler|phulkari|wrap')) return { type: 'clothing', category: 'dupattas-and-stoles', colours: COLOURS.festive, sizes: free };
    if (has(name, 'kurta material|fabric|material|yardage|tweed|by the met|running')) return { type: 'clothing', category: 'fabrics', colours: COLOURS.block, sizes: free };
    if (has(name, 'kurta|kurti|tunic')) return { type: 'clothing', category: 'kurtas', colours: COLOURS.festive, sizes: SIZES.adult };
    if (has(name, 'dhoti|mundu|lungi|veshti|gamosa|gamcha|angavastram')) return { type: 'clothing', category: 'dhotis-and-mundus', colours: COLOURS.white, sizes: free };
    if (has(name, 'suit|salwar|set')) return { type: 'clothing', category: 'suits-and-sets', colours: COLOURS.anarkali, sizes: SIZES.adult };
    if (has(name, 'jacket|coat|sweater|cardigan|knit|bundi|waistcoat|pullover')) return { type: 'clothing', category: 'jackets-and-knitwear', colours: COLOURS.wool, sizes: SIZES.adult };
    if (has(name, 'cap|topi|turban|pagri|pagadi|pheta|safa')) return { type: 'clothing', category: 'headwear', colours: COLOURS.turban, sizes: free };
    if (has(name, 'shirt|top|tee')) return { type: 'clothing', category: 'shirts-and-tops', colours: COLOURS.linen, sizes: SIZES.adult };
    return { type: 'clothing', category: 'fabrics', colours: COLOURS.block, sizes: free };
  }
  if (kind === 'footwear') {
    const colours = has(name, 'kolhapuri|kolapuri|chappal|sandal') ? COLOURS.kolhapuri : has(name, 'jutti|mojari|nagra') ? COLOURS.jutti : ['Tan', 'Brown', 'Black'];
    return { type: 'clothing', category: 'footwear', colours, sizes: has(name, 'kids|child') ? SIZES.shoeKids : SIZES.shoeU };
  }
  if (kind === 'accessories') {
    if (has(name, 'stole|scarf|muffler|shawl')) return { type: 'clothing', category: 'dupattas-and-stoles', colours: COLOURS.shawl, sizes: free };
    if (has(name, 'cap|topi|turban|pagri|hat')) return { type: 'clothing', category: 'headwear', colours: COLOURS.turban, sizes: free };
    const colours = has(name, 'bag|tote|pouch|purse|clutch|potli') ? COLOURS.bag : has(name, 'bangle|kada|chooda|chura|bracelet') ? COLOURS.bangles : COLOURS.trims;
    return { type: 'clothing', category: 'accessories', colours, sizes: has(name, 'bangle|kada|chooda|chura') ? SIZES.bangle : free };
  }
  if (kind === 'food') {
    const pantry = (category, packs) => ({ type: 'spice', category, packs: PACKS[packs] });
    if (has(name, 'pickle|achar|aachar|chutney|murabba|jam|preserve|sauce|thokku')) return pantry('pickles-and-chutneys', 'jar');
    if (has(name, 'papad|wadi|wadiyan|vadi|bari|fryum|sandige|vadam')) return pantry('papad-and-wadi', 'box');
    if (has(name, 'tea|chai|coffee|kahwa|kehwa|sharbat|juice|coconut water|drink|squash')) return pantry('tea-and-drinks', 'tea');
    if (has(name, 'masala|blend|garam|potli|spice mix|seasoning|podi|paste')) return pantry('masala-blends', 'small');
    if (has(name, 'sweet|halwa|barfi|burfi|ladoo|laddu|peda|mithai|chikki|petha|sandesh|rasgulla|pheni|gajak|tilkut|candy|toffee|sitabhog|mihidana|mysore pak|kaju katli|soan|balushahi|ghevar|rewri|revdi|pitha|bebinca|dodol|fudge|chocolate|jaggery|gud\\b'))
      return pantry('sweets', 'box');
    if (has(name, 'namkeen|bhujia|chips|mixture|bakarwadi|bhakarwadi|chakli|murukku|chivda|khakhra|mathri|nimki|snack|banana chips'))
      return pantry('snacks-and-namkeen', 'box');
    if (has(name, 'turmeric|haldi|chilli|chili|mirch|pepper|cardamom|elaichi|saffron|kesar|cinnamon|clove|cumin|jeera|hing|asafoetida|coriander|ginger|nutmeg|mace|fenugreek|methi|ajwain|fennel|saunf|star anise|bay lea|tejpat|kokum|amchur|timur|kalonji|spice'))
      return pantry(has(name, 'powder|ground') ? 'ground-spices' : 'whole-spices', 'small');
    if (has(name, 'rice|flour|atta|wheat|gehu|grain|dal\\b|lentil|millet|ragi|jowar|bajra|sattu|poha|honey|ghee|oil|besan|sooji|semolina|vermicelli|noodle|rajma|chana'))
      return pantry('rice-flours-and-staples', 'bag');
    return pantry('snacks-and-namkeen', 'box');
  }
  return { type: 'home', category: kind };
}

/** "800 - 3500" → 80000 paise (the low end); null when the file has no range. */
export function lowEndPaise(range) {
  const m = /^\s*(\d+)\s*-\s*\d+\s*$/.exec(range ?? '');
  return m ? Number(m[1]) * 100 : null;
}

/** All listings from the parsed CSV rows; problems lists rows that could not be placed. */
export function toListings(rows, regionSlugs) {
  const problems = [];
  const items = new Map(); // region|name (lower case) → listing
  const top = [];
  for (const row of rows) {
    const region = slugify(row.State_or_UT.replace(/&/g, 'and'));
    if (!regionSlugs.has(region)) {
      problems.push(`unknown state "${row.State_or_UT}"`);
      continue;
    }
    if (row.Category === TOP) {
      top.push({ row, region });
      continue;
    }
    const kind = FILE_CATEGORY[row.Category];
    if (!kind) {
      problems.push(`unknown category "${row.Category}"`);
      continue;
    }
    const key = `${region}|${row.Item_Name.trim().toLowerCase()}`;
    if (items.has(key)) continue; // the same item listed twice in one state
    items.set(key, { region, name: row.Item_Name.trim(), kind, summary: row.Key_Features_or_Details.trim() || null, rank: Number(row.Item_Rank) || 99 });
  }
  // A state's Top 10 rows are its picks (D-108): the same item, or a new one in the category its details name.
  for (const { row, region } of top) {
    const key = `${region}|${row.Item_Name.trim().toLowerCase()}`;
    const pick = Number(row.Item_Rank) || 10;
    const paise = lowEndPaise(row.Price_Range_INR);
    const existing = items.get(key);
    if (existing) {
      Object.assign(existing, { pick, paise: paise ?? existing.paise });
      continue;
    }
    const kind = FILE_CATEGORY[(row.Key_Features_or_Details.split(';')[1] ?? '').trim()];
    if (!kind) {
      problems.push(`${row.State_or_UT}: Top 10 "${row.Item_Name}" names no category`);
      continue;
    }
    items.set(key, { region, name: row.Item_Name.trim(), kind, summary: null, rank: 0, pick, paise });
  }

  const slugs = new Set();
  const listings = [...items.values()].map((item, index) => {
    const placed = classify(item.kind, item.name);
    let slug = `${item.region}-${slugify(item.name)}`;
    for (let n = 2; slugs.has(slug); n += 1) slug = `${item.region}-${slugify(item.name)}-${n}`;
    slugs.add(slug);
    const band = RUPEES[placed.category];
    const shopPaise = item.paise ?? (band[0] + (hash(slug) % (band[1] - band[0]))) * 100;
    const sku = `M${createHash('md5').update(slug).digest('hex').slice(0, 8).toUpperCase()}`;
    const qty = (s) => hash(s) % 11; // DEV PLACEHOLDER pieces, 0 to 10 (some sold out)
    let variants;
    if (placed.type === 'spice') {
      variants = placed.packs.map(([label, grams], i) => ({
        sku: `${sku}-${i + 1}`, label, options: { size: label }, weight_g: grams, shop_paise: Math.round(shopPaise * PACK_STEP[i]), qty: qty(`${sku}${i}`),
      }));
    } else if (placed.type === 'home') {
      variants = [{ sku: `${sku}-1`, label: 'Standard', options: {}, weight_g: null, shop_paise: null, qty: qty(sku) }];
    } else {
      const one = placed.sizes.length === 1;
      variants = placed.colours.flatMap((colour, ci) =>
        placed.sizes.map((size, si) => ({
          sku: `${sku}-${ci + 1}${String(si + 1).padStart(2, '0')}`, label: one ? colour : `${colour} · ${size}`,
          options: { colour, size }, weight_g: null, shop_paise: null, qty: qty(`${sku}${ci}-${si}`),
        })),
      );
    }
    return {
      slug, name: item.name, product_type: placed.type, region: item.region, category: placed.category,
      summary: item.summary, shop_paise: shopPaise, curated: item.pick !== undefined && item.pick <= 4,
      // Picks are the newest (New arrivals), then the rest in the file's order.
      age: item.pick !== undefined ? item.pick : 100 + index, variants,
    };
  });
  return { listings, problems };
}
