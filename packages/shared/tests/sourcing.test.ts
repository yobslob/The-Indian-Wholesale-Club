import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  bookmarkletHref,
  bookmarkletSource,
  captureFromHtml,
  cleanSourceUrl,
  decodeCapturePayload,
  guessCategory,
  guessDetails,
  guessProductType,
  guessRegionSlug,
  htmlToText,
  isPublicHttpsUrl,
  normalizeCapture,
  parseGrams,
  parseRupeesToPaise,
  parseShelfLifeDays,
  shorten,
  sourcedVariants,
  type CategoryChoice,
  type RawCapture,
} from '../src/sourcing';

const MYNTRA_HTML = `<html><head><title>Buy Saree Mall Banarasi Silk Saree | Myntra</title>
<link rel="canonical" href="https://www.myntra.com/sarees/saree+mall/saree-mall-banarasi-silk-saree/12345678/buy" />
<meta property="og:image" content="https://assets.myntassets.com/og.jpg" /></head><body>
<script>window.__myx = {"pdpData":{"name":"Woven Design Banarasi Silk Saree","brand":{"name":"Saree mall"},"mrp":4999,
"price":{"mrp":4999,"discounted":1749},"media":{"albums":[{"name":"default","images":[
{"secureSrc":"https://assets.myntassets.com/h_($height),q_($qualityPercentage),w_($width)/v1/assets/images/1.jpg"},
{"imageURL":"http://assets.myntassets.com/assets/images/2.jpg"}]}]},
"productDetails":[{"title":"Product Details","description":"<p>Gold-toned woven design saree&nbsp;with zari border</p><ul><li>Blouse piece</li></ul>"},
{"title":"Material & Care","description":"Silk Blend<br>Dry Clean"}],
"articleAttributes":{"Fabric":"Silk Blend","Wash Care":"Dry Clean","Ornamentation":"NA"},
"sizes":[{"label":"Onesize","available":true}],
"analytics":{"articleType":"Sarees","masterCategory":"Apparel","gender":"Women"}}};</script></body></html>`;

const SHOPIFY_HTML = `<html><head><meta property="og:title" content="Kerala Banana Chips 400g">
<meta property="og:price:amount" content="249.00"><meta property="og:price:currency" content="INR">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Kerala Banana Chips (400 g)",
"description":"Thin chips fried in coconut oil.\\nIngredients: Raw banana, coconut oil, salt","brand":{"@type":"Brand","name":"Snacky"},
"image":["https://cdn.shopify.com/s/files/chips.jpg"],"offers":{"@type":"Offer","price":"249.00","priceCurrency":"INR","availability":"https://schema.org/InStock"}}</script>
</head><body><h1>Kerala Banana Chips</h1></body></html>`;

const AMAZON: RawCapture = {
  v: 1,
  url: 'https://www.amazon.in/MDH-Kitchen-King-Masala-500g/dp/B00EXAMPLE/ref=sr_1_1?keywords=mdh&qid=1',
  title: 'Amazon.in',
  amazon: {
    title: '  MDH Kitchen King Masala, 500 g  ',
    price: '₹459.00',
    mrp: '₹500.00',
    byline: 'Visit the MDH Store',
    availability: 'In stock',
    bullets: ['Blend of 30 spices', 'For all vegetable dishes'],
    specs: [
      ['Net Quantity', '500.0 gram'],
      ['Ingredients', 'Coriander, Cumin, Turmeric'],
    ],
    images: [
      'https://m.media-amazon.com/images/I/71abc._SX679_.jpg',
      'https://m.media-amazon.com/images/I/71abc._SL1500_.jpg',
    ],
  },
};

const CATEGORIES: CategoryChoice[] = [
  { id: 'c-sarees', slug: 'sarees', name: 'Sarees & Drapes', product_type: 'clothing' },
  { id: 'c-kurtas', slug: 'kurtas', name: 'Kurtas & Kurtis', product_type: 'clothing' },
  { id: 'c-masala', slug: 'masala-blends', name: 'Masala Blends', product_type: 'food' },
  { id: 'c-snacks', slug: 'snacks-and-namkeen', name: 'Snacks & Namkeen', product_type: 'food' },
  { id: 'c-pooja', slug: 'pooja-and-spiritual', name: 'Pooja & Spiritual', product_type: 'home' },
];

describe('source links (D-110)', () => {
  it('cleans addresses so one product has one key', () => {
    assert.equal(cleanSourceUrl(AMAZON.url), 'https://www.amazon.in/dp/B00EXAMPLE');
    assert.equal(
      cleanSourceUrl('https://www.myntra.com/sarees/x/y/123/buy?utm_source=a#top'),
      'https://www.myntra.com/sarees/x/y/123/buy',
    );
    assert.equal(
      cleanSourceUrl('https://www.flipkart.com/p/itm1?pid=ABC&lid=x&marketplace=FLIPKART'),
      'https://www.flipkart.com/p/itm1?pid=ABC',
    );
    assert.equal(
      cleanSourceUrl('https://shop.example.in/products/chips?variant=1&utm_medium=x'),
      'https://shop.example.in/products/chips?variant=1',
    );
  });
  it('lets the server fetch only public https addresses', () => {
    assert.ok(isPublicHttpsUrl('https://assets.myntassets.com/a.jpg'));
    for (const bad of [
      'http://a.com/x',
      'https://127.0.0.1/x',
      'https://localhost/x',
      'https://[::1]/x',
      'https://db.internal/x',
      'https://a.com:8443/x',
      'javascript:alert(1)',
    ])
      assert.equal(isPublicHttpsUrl(bad), false, bad);
  });
  it('reads rupees, weights and shelf life', () => {
    assert.equal(parseRupeesToPaise('₹1,299.00'), 129900);
    assert.equal(parseRupeesToPaise('Rs. 249'), 24900);
    assert.equal(parseRupeesToPaise(1749), 174900);
    assert.equal(parseRupeesToPaise('free'), null);
    assert.equal(parseGrams('500.0 gram'), 500);
    assert.equal(parseGrams('1 kg'), 1000);
    assert.equal(parseShelfLifeDays('12 Months'), 360);
    assert.equal(htmlToText('<p>A&amp;B</p><ul><li>one</li></ul>'), 'A&B\n\n• one');
    assert.equal(
      shorten('MDH Kitchen King Masala, 500 g | Blend of spices for all vegetable dishes', 40),
      'MDH Kitchen King Masala, 500 g',
    );
  });
});

describe('a Myntra page', () => {
  const product = normalizeCapture(
    captureFromHtml(MYNTRA_HTML, 'https://www.myntra.com/whatever?x=1'),
  );
  it('reads the product from pdpData', () => {
    assert.ok(product);
    assert.equal(
      product.url,
      'https://www.myntra.com/sarees/saree+mall/saree-mall-banarasi-silk-saree/12345678/buy',
    );
    assert.equal(product.site, 'myntra.com');
    assert.equal(product.title, 'Woven Design Banarasi Silk Saree');
    assert.equal(product.brand, 'Saree mall');
    assert.equal(product.pricePaise, 174900);
    assert.equal(product.mrpPaise, 499900);
    assert.equal(product.currency, 'INR');
    assert.deepEqual(product.images, [
      'https://assets.myntassets.com/h_1440,q_90,w_1080/v1/assets/images/1.jpg',
      'https://assets.myntassets.com/assets/images/2.jpg',
    ]);
    assert.deepEqual(product.sizes, [{ label: 'Onesize', available: true }]);
    assert.match(
      product.description,
      /Gold-toned woven design saree with zari border\n\n• Blouse piece/,
    );
    assert.ok(!product.specs.some(([k]) => k === 'Ornamentation'), 'NA values are dropped');
  });
  it('guesses clothing, sarees, Uttar Pradesh, and the fabric and care', () => {
    assert.ok(product);
    assert.equal(guessProductType(product), 'clothing');
    assert.equal(guessCategory(product, 'clothing', CATEGORIES), 'c-sarees');
    assert.equal(guessRegionSlug(product), 'uttar-pradesh');
    const d = guessDetails(product);
    assert.equal(d.fibre, 'Silk Blend');
    assert.equal(d.care, 'Dry Clean');
  });
});

describe('an Amazon page (read by the bookmark)', () => {
  const product = normalizeCapture(AMAZON);
  it('reads title, brand, price, full-size photos and details', () => {
    assert.ok(product);
    assert.equal(product.url, 'https://www.amazon.in/dp/B00EXAMPLE');
    assert.equal(product.title, 'MDH Kitchen King Masala, 500 g');
    assert.equal(product.brand, 'MDH');
    assert.equal(product.pricePaise, 45900);
    assert.equal(product.inStock, true);
    assert.deepEqual(product.images, ['https://m.media-amazon.com/images/I/71abc.jpg']);
  });
  it('guesses food, masala blends, and the weight and ingredients', () => {
    assert.ok(product);
    assert.equal(guessProductType(product), 'food');
    assert.equal(guessCategory(product, 'food', CATEGORIES), 'c-masala');
    assert.equal(guessRegionSlug(product), null);
    const d = guessDetails(product);
    assert.equal(d.weightG, 500);
    assert.equal(d.ingredients, 'Coriander, Cumin, Turmeric');
  });
});

describe('any shop with schema.org data', () => {
  it('reads JSON-LD and meta tags', () => {
    const product = normalizeCapture(
      captureFromHtml(SHOPIFY_HTML, 'https://snacky.in/products/banana-chips'),
    );
    assert.ok(product);
    assert.equal(product.title, 'Kerala Banana Chips (400 g)');
    assert.equal(product.brand, 'Snacky');
    assert.equal(product.pricePaise, 24900);
    assert.equal(product.inStock, true);
    assert.equal(guessProductType(product), 'food');
    assert.equal(guessCategory(product, 'food', CATEGORIES), 'c-snacks');
    assert.equal(guessRegionSlug(product), 'kerala');
    assert.equal(guessDetails(product).ingredients, 'Raw banana, coconut oil, salt');
    assert.equal(guessDetails(product).weightG, 400);
  });
  it('refuses a page with no product', () => {
    assert.equal(
      normalizeCapture(captureFromHtml('<html><title>Login</title></html>', 'https://a.com/x')),
      null,
    );
  });
});

describe('the Add to IWC bookmark', () => {
  it('is valid JavaScript with the site baked in', () => {
    const source = bookmarkletSource('https://iwc.example.com');
    assert.doesNotThrow(() => new Function(source));
    assert.ok(source.includes("'https://iwc.example.com'"));
    const href = bookmarkletHref('https://iwc.example.com');
    assert.ok(href.startsWith('javascript:'));
    assert.doesNotThrow(() => new Function(decodeURIComponent(href.slice('javascript:'.length))));
  });
  it('sends a payload the import page decodes', () => {
    const json = JSON.stringify(AMAZON);
    const payload = Buffer.from(json, 'utf8').toString('base64');
    assert.deepEqual(decodeCapturePayload(payload), AMAZON);
    assert.equal(decodeCapturePayload('not base64 at all'), null);
  });
});

describe('options from the shop sizes', () => {
  it('turns sizes into options with pieces, and free size into One size', () => {
    assert.deepEqual(sourcedVariants([{ label: 'Onesize', available: true }], 5, null, true), [
      { label: 'One size', options: {}, qty: 5 },
    ]);
    assert.deepEqual(sourcedVariants([], 5, 450, false), [
      { label: 'One size', options: {}, qty: 0, weight_g: 450 },
    ]);
    assert.deepEqual(
      sourcedVariants(
        [
          { label: 'S', available: true },
          { label: 'M', available: false },
          { label: 's', available: true },
        ],
        3,
        null,
        true,
      ),
      [
        { label: 'S', options: { size: 'S' }, qty: 3 },
        { label: 'M', options: { size: 'M' }, qty: 0 },
      ],
    );
  });
});
