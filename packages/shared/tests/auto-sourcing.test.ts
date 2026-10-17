import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { optionAxes, variantLabel } from '../src/domain';
import {
  captureScript,
  normalizeCapture,
  optionKeyFor,
  packGrams,
  parseDeliveryDays,
  shopifyVariants,
  type RawCapture,
  type SourcedProduct,
} from '../src/sourcing';
import {
  amazonSearchOffers,
  bigbasketFamily,
  bigbasketOffers,
  blinkitItem,
  blinkitOffers,
  buildListing,
  checkPage,
  flipkartSearchOffers,
  genericOffers,
  listingName,
  myntraSearchOffers,
  inBand,
  parseTargetsCsv,
  pickCandidates,
  shopsFor,
  sanitizeText,
  shopifySearchOffers,
  targetMatcher,
  type Offer,
  type SourcingShop,
  type SourcingTarget,
} from '../src/sourcing/auto';

// Tuesday 13 Oct 2026, 10:00 in India
const NOW = new Date('2026-10-13T04:30:00Z');

const target = (over: Partial<SourcingTarget> = {}): SourcingTarget => ({
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Himachali rajma',
  query: 'himachali rajma',
  must_match: 'rajma',
  product_type: 'food',
  category: 'rice-flours-and-staples',
  region: 'himachal-pradesh',
  tier: 1,
  sites: null,
  min_price_paise: null,
  max_price_paise: null,
  listings: null,
  ...over,
});
const SHOPS: SourcingShop[] = [
  {
    site: 'blinkit.com',
    label: 'Blinkit',
    reader: 'blinkit',
    product_types: ['food', 'home'],
    delivery_days: 3,
  },
  {
    site: 'amazon.in',
    label: 'Amazon India',
    reader: 'amazon',
    product_types: ['clothing', 'food', 'home'],
    delivery_days: null,
  },
  {
    site: 'bigbasket.com',
    label: 'BigBasket',
    reader: 'bigbasket',
    product_types: ['food', 'home'],
    delivery_days: 3,
  },
];
const offer = (over: Partial<Offer>): Offer => ({
  site: 'amazon.in',
  url: 'https://www.amazon.in/dp/B000000001',
  key: 'B000000001',
  title: 'x',
  brand: null,
  pricePaise: 10000,
  mrpPaise: null,
  inStock: true,
  deliveryText: null,
  pack: null,
  rating: null,
  ratingCount: null,
  sponsored: false,
  image: null,
  group: null,
  siblings: [],
  ...over,
});

describe('delivery promises in days (India time)', () => {
  it('reads minutes, days and dates', () => {
    assert.equal(parseDeliveryDays('15 MINS', NOW), 0);
    assert.equal(parseDeliveryDays('Delivery in 14 minutes', NOW), 0);
    assert.equal(parseDeliveryDays('FREE delivery Tomorrow', NOW), 1);
    assert.equal(
      parseDeliveryDays('FREE delivery Wednesday, 21 October. Order within 3 hrs 20 mins.', NOW),
      8,
    );
    assert.equal(parseDeliveryDays('Delivery by\nFriday, 16 Oct', NOW), 3);
    assert.equal(parseDeliveryDays('Get it by Oct 15 - 17', NOW), 4);
    assert.equal(parseDeliveryDays('Delivered in 2-3 days', NOW), 3);
    assert.equal(parseDeliveryDays('Fastest delivery Tomorrow. FREE delivery Thu, 15 Oct', NOW), 2);
    assert.equal(parseDeliveryDays('Delivery by Thursday', NOW), 2);
    assert.equal(parseDeliveryDays('Currently unavailable', NOW), null);
    assert.equal(parseDeliveryDays('Delivery by 2 Jan', new Date('2026-12-28T04:30:00Z')), 5);
  });
});

describe('variants: any option, any shop (D-118)', () => {
  it('names options from the shop’s names and values', () => {
    assert.equal(optionKeyFor('flavor_name'), 'flavour');
    assert.equal(optionKeyFor('Colour'), 'colour');
    assert.equal(optionKeyFor('size_name', ['500 g', '1 kg']), 'pack');
    assert.equal(optionKeyFor('size_name', ['S', 'M']), 'size');
    assert.equal(optionKeyFor('style_name'), 'style');
    assert.equal(packGrams('2 x 500 g'), 1000);
    assert.equal(packGrams('1 kg'), 1000);
    assert.equal(packGrams('200 ml'), 200);
  });

  it('shows one row per option: flavour and pack for food', () => {
    const v = (flavour: string, pack: string) => ({ options: { flavour, pack } });
    const axes = optionAxes([v('Malai', '400 g'), v('Mawa', '400 g'), v('Malai', '800 g')]);
    assert.deepEqual(
      axes.map((a) => [a.key, a.label]),
      [
        ['flavour', 'Flavour'],
        ['pack', 'Pack'],
      ],
    );
    assert.equal(variantLabel({ flavour: 'Malai', pack: '400 g' }), 'Malai · 400 g');
  });

  // The founder's screenshot: Amazon's "Flavour Name" picker with a price per flavour.
  const chikki: RawCapture = {
    v: 1,
    url: 'https://www.amazon.in/Chikki/dp/B09P6H1PZH?th=1',
    amazon: {
      title: 'Peanut Chikki 500 g',
      price: '₹499.00',
      mrp: '₹599.00',
      availability: 'In stock',
      asin: 'B09P6H1PZH',
      images: ['https://m.media-amazon.com/images/I/a._SX679_.jpg'],
      twister: {
        dims: ['flavor_name'],
        labels: { flavor_name: 'Flavour Name' },
        values: {
          B09P6CV2BK: ['Crushed Peanut Chikki'],
          B0BT4TM5HY: ['Chocolate Malai Chikki'],
          B09P6H1PZH: ['Assorted Chikki'],
          B0BT4S8HGW: ['Mawa Malai Chikki'],
          B09P78ZG2L: ['Malai Chikki'],
        },
        swatches: [
          { asin: 'B0BT4TM5HY', price: '₹549.00', mrp: '₹699.00', available: true },
          { asin: 'B09P6CV2BK', price: '₹549.00', mrp: '₹799.00', available: true },
          { asin: 'B09P78ZG2L', price: '₹464.00', mrp: '₹699.00', available: true },
          { asin: 'B0BT4S8HGW', price: '₹549.00', mrp: '₹799.00', available: false },
        ],
      },
    },
    delivery: 'FREE delivery Thursday, 15 October',
  };

  it('turns Amazon’s flavour picker into flavours, each with its own price', () => {
    const p = normalizeCapture(chikki)!;
    assert.equal(p.variants.length, 5);
    const byFlavour = Object.fromEntries(p.variants.map((v) => [v.options.flavour, v]));
    assert.equal(byFlavour['Assorted Chikki']!.pricePaise, 49900);
    assert.equal(byFlavour['Malai Chikki']!.pricePaise, 46400);
    assert.equal(byFlavour['Chocolate Malai Chikki']!.mrpPaise, 69900);
    assert.equal(byFlavour['Mawa Malai Chikki']!.inStock, false);
    assert.equal(byFlavour['Crushed Peanut Chikki']!.url, 'https://www.amazon.in/dp/B09P6CV2BK');
    assert.equal(p.deliveryText, 'FREE delivery Thursday, 15 October');
  });

  it('reads Flipkart’s option links as pack sizes', () => {
    const p = normalizeCapture({
      v: 1,
      url: 'https://www.flipkart.com/truefarm-unpolished-rajma/p/itmf7gyagsq3nzgg?pid=PLSFDGXMBNNNFHG9',
      ld: [
        JSON.stringify({
          '@type': 'Product',
          name: 'Truefarm Unpolished Rajma',
          image: ['https://rukmini1.flixcart.com/a.jpeg'],
          offers: { price: 301, priceCurrency: 'INR', availability: 'InStock' },
        }),
      ],
      swatch: {
        selected: [['Quantity', '1 kg']],
        links: [
          {
            url: '/truefarm-unpolished-rajma/p/itmf7gyagsq3nzgg?pid=PLSF7HFDND5GTGKC&marketplace=FLIPKART',
            label: '500 g (₹326/1kg)',
            axis: 'Quantity',
          },
          {
            url: '/truefarm-unpolished-rajma/p/itmf7gyagsq3nzgg?pid=PLSFDGXMBNNNFHG9',
            label: '1 kg (₹301/1kg)',
            axis: 'Quantity',
          },
        ],
      },
    })!;
    assert.deepEqual(
      p.variants.map((v) => [v.key, v.options.pack, v.pricePaise]),
      [
        ['PLSFDGXMBNNNFHG9', '1 kg', 30100],
        ['PLSF7HFDND5GTGKC', '500 g', null],
      ],
    );
  });

  it('reads Shopify’s variants (prices in paise there)', () => {
    const vs = shopifyVariants(
      {
        options: [{ name: 'Color' }, { name: 'Size' }],
        variants: [
          { id: 1, option1: 'Indigo', option2: 'M', price: 189900, available: true },
          { id: 2, option1: 'Indigo', option2: 'L', price: 189900, available: false },
        ],
      },
      'https://oyela.in/products/kurta?x=1',
    );
    assert.deepEqual(
      vs.map((v) => [v.label, v.pricePaise, v.inStock, v.url]),
      [
        ['Indigo · M', 189900, true, 'https://oyela.in/products/kurta?variant=1'],
        ['Indigo · L', 189900, false, 'https://oyela.in/products/kurta?variant=2'],
      ],
    );
  });

  it('has a capture the runner can evaluate', () => {
    assert.doesNotThrow(() => new Function(`return ${captureScript};`));
  });
});

describe('matching a target', () => {
  it('needs the target’s words and refuses other forms of it', () => {
    const m = targetMatcher(target());
    assert.ok(m.matches('Tata Sampann Unpolished Rajma Chitra 500 g'));
    assert.ok(!m.matches('Everest Rajma Masala 100 g'), 'rajma masala is not rajma');
    assert.ok(!m.matches('Kidney beans 1 kg'), 'must say rajma');
    const chikki = targetMatcher(
      target({ name: 'Lonavala chikki', query: 'lonavala chikki', must_match: 'chikki' }),
    );
    assert.ok(chikki.matches('Chocolate Malai Chikki 500 g'), 'a flavour is not another product');
    const pickle = targetMatcher(
      target({
        name: 'Avakaya mango pickle',
        query: 'avakaya pickle',
        must_match: 'avakaya|avakai',
      }),
    );
    assert.ok(
      pickle.matches('Priya Avakaya Mango Pickles 300 g'),
      'the target’s own form word is fine',
    );
  });
});

describe('picking listings from every shop’s results', () => {
  it('keeps fast, in-stock matches, puts one product on two shops together, different brands first', () => {
    const offers = [
      offer({
        site: 'blinkit.com',
        key: '289037',
        url: 'https://blinkit.com/prn/x/prid/289037',
        title: 'Tata Sampann Unpolished Rajma 500 g',
        brand: 'Tata Sampann',
        pack: '500 g',
        deliveryText: '15 MINS',
        pricePaise: 10700,
      }),
      offer({
        key: 'B0RAJMA001',
        url: 'https://www.amazon.in/dp/B0RAJMA001',
        title: 'Tata Sampann Unpolished Rajma, 500g',
        brand: 'Tata Sampann',
        deliveryText: 'FREE delivery Thu, 15 Oct',
        pricePaise: 11500,
        ratingCount: 16000,
        rating: 4.3,
      }),
      offer({
        key: 'B0RAJMA002',
        url: 'https://www.amazon.in/dp/B0RAJMA002',
        title: 'Himalayan Rajma 1 kg',
        brand: 'Hill',
        deliveryText: 'FREE delivery Wednesday, 21 October',
      }),
      offer({
        key: 'B0RAJMA003',
        url: 'https://www.amazon.in/dp/B0RAJMA003',
        title: 'Rajma Masala 100 g',
        brand: 'Everest',
      }),
      offer({
        site: 'blinkit.com',
        key: '1',
        url: 'https://blinkit.com/prn/x/prid/1',
        title: 'Pahadi Rajma 1 kg',
        brand: 'Pahadi',
        inStock: false,
      }),
      offer({
        site: 'bigbasket.com',
        key: '70001287',
        url: 'https://www.bigbasket.com/pd/70001287/x/',
        title: 'bb Royal Rajma Kashmiri 1 kg',
        brand: 'bb Royal',
        pack: '1 kg',
      }),
    ];
    const picked = pickCandidates(target(), offers, SHOPS, {
      maxDays: 3,
      known: new Set(['bigbasket.com|70001287']),
      now: NOW,
      limit: 3,
    });
    assert.deepEqual(
      picked.map((c) => [c.best.key, c.others.map((o) => o.key)]),
      [['B0RAJMA001', ['289037']]],
    );
  });
});

describe('the listing the runner adds', () => {
  const product: SourcedProduct = {
    url: 'https://www.amazon.in/dp/B09P6H1PZH',
    site: 'amazon.in',
    title: 'Amazon Brand - Vedaka Peanut Chikki (500 g) | Crunchy',
    brand: 'Vedaka',
    description:
      'Made with jaggery and peanuts. Buy online on Amazon with free delivery.\nNo preservatives.',
    bullets: ['Crunchy peanut brittle', '7 day replacement'],
    specs: [
      ['Ingredients', 'Peanuts, jaggery'],
      ['Allergen information', 'Peanuts'],
    ],
    images: ['https://m.media-amazon.com/images/I/a.jpg'],
    pricePaise: 49900,
    mrpPaise: null,
    currency: 'INR',
    inStock: true,
    sizes: [],
    hints: [],
    variants: normalizeCapture({
      v: 1,
      url: 'https://www.amazon.in/dp/B09P6H1PZH',
      amazon: {
        title: 'x',
        price: '₹499',
        asin: 'B09P6H1PZH',
        twister: {
          dims: ['flavor_name'],
          values: { B09P6H1PZH: ['Assorted'], B09P78ZG2L: ['Malai'] },
          swatches: [{ asin: 'B09P78ZG2L', price: '₹464' }],
        },
      },
    })!.variants,
    deliveryText: 'FREE delivery Thursday, 15 October',
  };

  it('keeps every flavour with its price, removes the shop from every word, and finds the food details', () => {
    const draft = buildListing({
      product,
      target: target({ name: 'Lonavala chikki', query: 'chikki', must_match: 'chikki' }),
      shop: SHOPS[1]!,
      pageDays: 2,
      family: [],
      others: [],
      shops: SHOPS,
      maxDays: 3,
      now: NOW,
    });
    assert.ok(!('skip' in draft));
    if ('skip' in draft) return;
    assert.equal(draft.listing.name, 'Vedaka Peanut Chikki');
    assert.deepEqual(
      draft.listing.variants.map((v) => [v.label, v.price_paise]),
      [
        ['Assorted', 49900],
        ['Malai', 46400],
      ],
    );
    assert.ok(!/amazon|delivery|replacement/i.test(draft.listing.description));
    assert.match(draft.listing.description, /No preservatives/);
    assert.deepEqual(draft.listing.attributes, {
      ingredients: 'Peanuts, jaggery',
      allergens: ['Peanuts'],
    });
    assert.equal(draft.complete, false, 'no shelf life on the page: it waits for an admin');
    assert.deepEqual(draft.missing, ['shelf_life_days'], 'the run log names what is missing (D-137)');
  });

  it('skips a page that is too slow or promises nothing', () => {
    const base = {
      product,
      target: target(),
      family: [],
      others: [],
      shops: SHOPS,
      maxDays: 3,
      now: NOW,
    };
    assert.deepEqual(buildListing({ ...base, shop: SHOPS[1]!, pageDays: 8 }), {
      skip: 'delivery takes 8 days',
    });
    assert.deepEqual(buildListing({ ...base, shop: SHOPS[1]!, pageDays: null }), {
      skip: 'the page promises no delivery date',
    });
  });

  it('cleans names and words', () => {
    assert.equal(
      listingName('Tata Sampann Unpolished Rajma, 500g'),
      'Tata Sampann Unpolished Rajma',
    );
    assert.equal(
      sanitizeText('Rich in protein. Available on Flipkart at the best price.'),
      'Rich in protein.',
    );
    assert.equal(
      sanitizeText('✅ Crunchy\nImportant information Legal Disclaimer: see our app or website.'),
      'Crunchy',
    );
    assert.equal(
      listingName(
        'LONAVALA FOODS Famous Malai Chikki - 500 grams, 48 Pieces | No Added Preservatives',
      ),
      'LONAVALA FOODS Famous Malai Chikki',
    );
  });
});

describe('a real page: Amazon’s Lonavala chikki, read on 13 Oct 2026', () => {
  it('becomes five flavours with the prices the page showed', async () => {
    const { readFileSync } = await import('node:fs');
    const raw = JSON.parse(
      readFileSync(new URL('./fixtures/amazon-chikki.json', `file://${__filename}`), 'utf8'),
    ) as RawCapture;
    const p = normalizeCapture(raw)!;
    assert.deepEqual(p.variants.map((v) => [v.options.flavour, v.pricePaise]).sort(), [
      ['Assorted Chikki', 49900],
      ['Chocolate Malai Chikki', 54900],
      ['Crushed Peanut Chikki', 54900],
      ['Malai Chikki', 46400],
      ['Mawa Malai Chikki', 54900],
    ]);
    assert.equal(
      parseDeliveryDays(p.deliveryText, NOW),
      7,
      'Tuesday 20 October: too slow for the hub, so not added',
    );
  });
});

describe('the weekly check of a page', () => {
  it('finds each source’s item by id or label, and reports new flavours', () => {
    const p = normalizeCapture({
      v: 1,
      url: 'https://www.amazon.in/dp/B09P6H1PZH',
      amazon: {
        title: 'x',
        price: '₹520',
        asin: 'B09P6H1PZH',
        twister: {
          dims: ['flavor_name'],
          values: { B09P6H1PZH: ['Assorted'], B09P78ZG2L: ['Malai'], B0NEWFLAV1: ['Rose'] },
          swatches: [
            { asin: 'B09P78ZG2L', available: false },
            { asin: 'B0NEWFLAV1', price: '₹600' },
          ],
        },
      },
    })!;
    const src = (id: string, key: string | null, label: string) => ({
      id,
      site: 'amazon.in',
      page_url: p.url,
      item_url: p.url,
      item_key: key,
      label,
      options: {},
    });
    const { results, added } = checkPage(
      [
        src('00000000-0000-4000-8000-00000000000a', 'B09P6H1PZH', 'Assorted'),
        src('00000000-0000-4000-8000-00000000000b', 'B09P78ZG2L', 'Malai'),
      ],
      p,
      2,
    );
    assert.deepEqual(
      results.map((r) => [r.ok, r.price_paise, r.error]),
      [
        [true, 52000, undefined],
        [false, undefined, 'no price shown'],
      ],
    );
    assert.deepEqual(
      added.map((a) => [a.item_key, a.label, a.price_paise]),
      [['B0NEWFLAV1', 'Rose', 60000]],
    );
  });
  it('fails every source of a page that could not be read', () => {
    const { results } = checkPage(
      [
        {
          id: '00000000-0000-4000-8000-00000000000a',
          site: 's',
          page_url: 'https://a.b/c',
          item_url: 'https://a.b/c',
          item_key: null,
          label: 'M',
          options: {},
        },
      ],
      null,
      null,
      'blocked',
    );
    assert.deepEqual(results, [
      { id: '00000000-0000-4000-8000-00000000000a', ok: false, error: 'blocked' },
    ]);
  });
});

describe('shop readers', () => {
  it('Blinkit: cart items in the page state, and one item’s stock', () => {
    const state = {
      ui: {
        search: {
          snippets: [
            {
              data: {
                atc: {
                  cart_item: {
                    product_id: 289037,
                    product_name: 'Tata Sampann Unpolished Rajma',
                    price: 107,
                    mrp: 116,
                    unit: '500 g',
                    inventory: 15,
                    group_id: 9,
                    brand: 'Tata Sampann',
                    image_url: 'https://cdn.grofers.com/a.png',
                  },
                },
              },
            },
          ],
        },
      },
    };
    const [o] = blinkitOffers(state, '15 MINS');
    assert.deepEqual(
      [o!.key, o!.pricePaise, o!.mrpPaise, o!.inStock, o!.pack, o!.group],
      ['289037', 10700, 11600, true, '500 g', '9'],
    );
    assert.deepEqual(
      blinkitItem({ a: { product_id: '289037', price: 107, inventory: 0 } }, '289037'),
      { pricePaise: 10700, mrpPaise: null, inStock: false },
    );
  });
  it('BigBasket: products and their pack sizes; "not delivering" is out of stock', () => {
    const item = (id: string, w: string, sp: string, status: string) => ({
      id,
      desc: 'Rajma - Kashmiri',
      w,
      absolute_url: `/pd/${id}/x/`,
      brand: { name: 'bb Royal' },
      availability: { avail_status: status },
      pricing: { discount: { mrp: '210', prim_price: { sp } } },
      images: [{ l: 'https://www.bbassets.com/a.jpg' }],
    });
    const offers = bigbasketOffers({
      tabs: [
        {
          product_info: {
            products: [
              { ...item('1', '1 kg', '138', '001'), children: [item('2', '200 g', '28', '010')] },
            ],
          },
        },
      ],
    });
    assert.deepEqual(
      offers.map((o) => [o.key, o.pricePaise, o.inStock, o.group]),
      [
        ['1', 13800, true, '1'],
        ['2', 2800, false, '1'],
      ],
    );
    const family = bigbasketFamily({
      props: {
        pageProps: {
          productDetails: {
            children: [item('2', '200 g', '28', '001'), item('1', '1 kg', '138', '001')],
          },
        },
      },
    });
    assert.deepEqual(
      family.map((o) => [o.key, o.pack, o.group]),
      [
        ['2', '200 g', 'page'],
        ['1', '1 kg', 'page'],
      ],
    );
  });
  it('Flipkart cards, Amazon rows and Myntra data', () => {
    const [f] = flipkartSearchOffers([
      {
        id: 'PLSFDGXMBNNNFHG9',
        text: 'Truefarm Unpolished Rajma\n4.1(348)\n₹301₹39824% off',
        href: '/truefarm/p/itm1?pid=PLSFDGXMBNNNFHG9&lid=x',
        image: '',
      },
    ]);
    assert.deepEqual(
      [f!.title, f!.pricePaise, f!.mrpPaise, f!.rating, f!.ratingCount, f!.url],
      [
        'Truefarm Unpolished Rajma',
        30100,
        39800,
        4.1,
        348,
        'https://www.flipkart.com/truefarm/p/itm1?pid=PLSFDGXMBNNNFHG9',
      ],
    );
    const [a] = amazonSearchOffers([
      {
        asin: 'B0RAJMA001',
        title: 'Rajma 1 kg',
        price: '₹1,299',
        mrp: '₹1,500',
        delivery: 'FREE delivery Wed, 21 Oct',
        rating: '4.3 out of 5 stars',
        count: '(1.2K)',
        sponsored: true,
        image: '',
      },
    ]);
    assert.deepEqual(
      [a!.pricePaise, a!.rating, a!.ratingCount, a!.sponsored],
      [129900, 4.3, 1200, true],
    );
    const [m] = myntraSearchOffers([
      {
        productId: 123,
        landingPageUrl: 'kurtas/x/123/buy',
        productName: 'Anouk Kurta',
        brand: 'Anouk',
        price: 899,
        mrp: 1999,
        inventoryInfo: [{ available: true }],
        colourVariants: [{ styleId: 124 }, { styleId: 123 }],
      },
    ]);
    assert.deepEqual(
      [m!.pricePaise, m!.inStock, m!.siblings],
      [89900, true, ['https://www.myntra.com/124']],
    );
  });
  it('Shopify search, and a generic page whose prices are in paise', () => {
    const [s] = shopifySearchOffers(
      {
        resources: {
          results: {
            products: [
              { handle: 'indigo-kurta', title: 'Indigo kurta', price: '1899.00', available: true },
            ],
          },
        },
      },
      'oyela.in',
    );
    assert.deepEqual([s!.url, s!.pricePaise], ['https://oyela.in/products/indigo-kurta', 189900]);
    const blob = {
      items: [
        {
          productVariantId: 'v1',
          name: 'Rajma',
          sellingPrice: 10700,
          mrp: 11600,
          formattedPacksize: '500 g',
          outOfStock: false,
        },
      ],
    };
    const [g] = genericOffers(
      [blob],
      'Rajma 500 g ₹107 ₹116',
      'zepto.com',
      (id) => `https://www.zepto.com/pn/x/pvid/${id}`,
      '10 mins',
    );
    assert.deepEqual(
      [g!.pricePaise, g!.mrpPaise, g!.inStock, g!.url],
      [10700, 11600, true, 'https://www.zepto.com/pn/x/pvid/v1'],
    );
  });
});

describe('targets from the bestseller CSV', () => {
  it('finds columns by heading and reports bad rows', () => {
    const csv =
      'State,Tier,Product,Type,IWC category,IWC region slug,Search words,Must match\n' +
      'Himachal Pradesh,1 · List first,"Himachali rajma",food,rice-flours-and-staples,himachal-pradesh,himachali rajma,rajma\n' +
      'Kerala,2 · List next,Kasavu saree,clothing,sarees,kerala,,\n' +
      'X,3,Bad,toys,x,y,,\n';
    const { rows, errors } = parseTargetsCsv(csv);
    assert.deepEqual(
      rows.map((r) => [r.name, r.query, r.must_match, r.tier]),
      [
        ['Himachali rajma', 'himachali rajma', 'rajma', 1],
        ['Kasavu saree', 'Kasavu saree', null, 2],
      ],
    );
    assert.equal(errors.length, 1);
  });

  it('D-121: all states, its shops, a price band in rupees and how many listings', () => {
    const csv =
      'Product,Type,IWC category,IWC region slug,Shops,Min ₹,Max ₹,Listings\n' +
      "Women's printed kurtas,clothing,kurtas,all,myntra,₹600,\"1,600\",25\n" +
      'Cotton sarees,clothing,sarees,,myntra.com; https://www.amazon.in/,600,,\n' +
      'Odd,clothing,sarees,,myntra,abc,,\n';
    const { rows, errors } = parseTargetsCsv(csv);
    assert.deepEqual(
      rows.map((r) => [r.name, r.region, r.shops, r.min_price_paise, r.max_price_paise, r.listings]),
      [
        ["Women's printed kurtas", null, ['myntra'], 60000, 160000, 25],
        ['Cotton sarees', null, ['myntra.com', 'amazon.in'], 60000, null, null],
      ],
    );
    assert.equal(errors.length, 1, 'a price that is not a number refuses the row');
  });
});

describe('a target with its own shops and a price band (D-121)', () => {
  const band = target({
    name: 'Cotton kurtas',
    query: 'cotton kurta',
    must_match: 'kurta',
    product_type: 'clothing',
    region: null,
    sites: ['amazon.in'],
    min_price_paise: 60000,
    max_price_paise: 160000,
  });

  it('searches only its shops and keeps prices inside the band', () => {
    assert.deepEqual(
      shopsFor(band, SHOPS).map((s) => s.site),
      ['amazon.in'],
    );
    assert.deepEqual(
      shopsFor(target(), SHOPS).map((s) => s.site),
      ['blinkit.com', 'amazon.in', 'bigbasket.com'],
    );
    assert.ok(inBand(band, 60000) && inBand(band, 160000) && !inBand(band, 59900) && !inBand(band, 160100));
    assert.ok(inBand(target(), 100) && !inBand(target(), null));
    const picked = pickCandidates(
      band,
      [
        offer({ key: 'A1', title: 'Cotton Kurta', pricePaise: 89900, brand: 'A' }),
        offer({ key: 'A2', title: 'Cotton Kurta', pricePaise: 249900, brand: 'B' }),
        offer({ key: 'A3', title: 'Cotton Kurta', pricePaise: 39900, brand: 'C' }),
        offer({ site: 'blinkit.com', key: 'B1', title: 'Cotton Kurta', pricePaise: 89900, brand: 'D' }),
      ],
      SHOPS,
      { maxDays: 3, known: new Set(), now: NOW, limit: 3 },
    );
    assert.deepEqual(
      picked.map((c) => c.best.key),
      ['A1'],
    );
  });

  it('leaves out colours outside the band and pages made outside India', () => {
    const kurta: SourcedProduct = {
      url: 'https://www.amazon.in/dp/B0KURTA001',
      site: 'amazon.in',
      title: 'Anouk Women Cotton Kurta',
      brand: 'Anouk',
      description: '',
      bullets: [],
      specs: [['Country of Origin', 'India']],
      images: ['https://m.media-amazon.com/images/I/k.jpg'],
      pricePaise: 89900,
      mrpPaise: null,
      currency: 'INR',
      inStock: true,
      sizes: [],
      hints: [],
      variants: [
        { key: 'B0KURTA001', url: 'https://www.amazon.in/dp/B0KURTA001', label: 'Blue', options: { colour: 'Blue' }, pricePaise: 89900, mrpPaise: null, inStock: true, weightG: null, image: null },
        { key: 'B0KURTA002', url: 'https://www.amazon.in/dp/B0KURTA002', label: 'Silk red', options: { colour: 'Silk red' }, pricePaise: 259900, mrpPaise: null, inStock: true, weightG: null, image: null },
      ],
      deliveryText: null,
    };
    const base = { target: band, shop: SHOPS[1]!, pageDays: 2, family: [], others: [], shops: SHOPS, maxDays: 3, now: NOW };
    const draft = buildListing({ ...base, product: kurta });
    assert.ok(!('skip' in draft));
    if ('skip' in draft) return;
    assert.deepEqual(
      draft.listing.variants.map((v) => v.label),
      ['Blue'],
    );
    assert.deepEqual(
      buildListing({ ...base, product: { ...kurta, specs: [['Country of Origin', 'China']] } }),
      { skip: 'made in China, not India' },
    );
    assert.deepEqual(
      buildListing({ ...base, product: { ...kurta, variants: [kurta.variants[1]!] } }),
      { skip: 'price outside the band' },
    );
  });
});
