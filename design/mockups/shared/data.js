/*
 * Mockup data (C1). Region names, slugs and greetings mirror supabase/seed/regions.sql
 * (greetings are DRAFTS, D-019). Live regions, product names, prices and counts mirror the
 * dev placeholders in supabase/seed/demo.sql; rows marked `sample` exist only to fill the
 * layouts. Nothing here is a business fact.
 */
window.IWC = window.IWC || {};

IWC.regions = [
  ['andaman-and-nicobar-islands', 'Andaman and Nicobar Islands', null],
  ['andhra-pradesh', 'Andhra Pradesh', 'నమస్కారం'],
  ['arunachal-pradesh', 'Arunachal Pradesh', null],
  ['assam', 'Assam', 'নমস্কাৰ'],
  ['bihar', 'Bihar', 'प्रणाम'],
  ['chandigarh', 'Chandigarh', 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ'],
  ['chhattisgarh', 'Chhattisgarh', 'जय जोहार'],
  ['dadra-and-nagar-haveli-and-daman-and-diu', 'Dadra and Nagar Haveli and Daman and Diu', 'કેમ છો'],
  ['delhi', 'Delhi', 'नमस्ते'],
  ['goa', 'Goa', null],
  ['gujarat', 'Gujarat', 'કેમ છો'],
  ['haryana', 'Haryana', 'राम राम'],
  ['himachal-pradesh', 'Himachal Pradesh', 'नमस्ते'],
  ['jammu-and-kashmir', 'Jammu and Kashmir', null],
  ['jharkhand', 'Jharkhand', 'जोहार'],
  ['karnataka', 'Karnataka', 'ನಮಸ್ಕಾರ'],
  ['kerala', 'Kerala', 'നമസ്കാരം'],
  ['ladakh', 'Ladakh', null],
  ['lakshadweep', 'Lakshadweep', null],
  ['madhya-pradesh', 'Madhya Pradesh', 'नमस्ते'],
  ['maharashtra', 'Maharashtra', 'नमस्कार'],
  ['manipur', 'Manipur', null],
  ['meghalaya', 'Meghalaya', 'Khublei'],
  ['mizoram', 'Mizoram', 'Chibai'],
  ['nagaland', 'Nagaland', null],
  ['odisha', 'Odisha', 'ନମସ୍କାର'],
  ['puducherry', 'Puducherry', 'வணக்கம்'],
  ['punjab', 'Punjab', 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ'],
  ['rajasthan', 'Rajasthan', 'खम्मा घणी'],
  ['sikkim', 'Sikkim', 'नमस्ते'],
  ['tamil-nadu', 'Tamil Nadu', 'வணக்கம்'],
  ['telangana', 'Telangana', 'నమస్కారం'],
  ['tripura', 'Tripura', 'নমস্কার'],
  ['uttar-pradesh', 'Uttar Pradesh', 'नमस्ते'],
  ['uttarakhand', 'Uttarakhand', 'नमस्ते'],
  ['west-bengal', 'West Bengal', 'নমস্কার'],
].map(([slug, name, greeting]) => ({
  slug,
  name,
  greeting,
  live: ['kerala', 'rajasthan', 'punjab'].includes(slug), // dev demo only
}));

/** Placeholder photo classes (shared/mockup.css) per live region. */
IWC.regionPhoto = { kerala: 'ph--land-kerala', rajasthan: 'ph--land-raj', punjab: 'ph--land-punjab' };

// ph = placeholder class, label = what the real photo would show.
IWC.products = [
  { region: 'kerala', name: 'Kasavu saree', price: '$99', avail: 3, ph: 'ph--kasavu', label: 'Kasavu saree, worn' },
  { region: 'kerala', name: 'Mundu', price: '$39', avail: 5, ph: 'ph--mundu', label: 'Mundu, folded' },
  { region: 'kerala', name: 'Sample: set mundu', price: '$—', avail: 2, ph: 'ph--kasavu', label: 'Set mundu, draped', sample: true },
  { region: 'kerala', name: 'Sample: cotton kurta', price: '$—', avail: 4, ph: 'ph--portrait', label: 'Kurta, worn', sample: true },
  { region: 'kerala', name: 'Sample: kasavu dupatta', price: '$—', avail: 1, ph: 'ph--mundu', label: 'Dupatta, detail', sample: true },
  { region: 'rajasthan', name: 'Bandhani dupatta', price: '$49', avail: 4, ph: 'ph--bandhani', label: 'Bandhani dupatta, detail' },
  { region: 'punjab', name: 'Phulkari dupatta', price: '$59', avail: 2, ph: 'ph--phulkari', label: 'Phulkari dupatta, detail' },
];

IWC.esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Placeholder photo markup. `extra` adds classes, `ar` sets the aspect ratio. */
IWC.ph = (cls, label, extra = '', ar = '') =>
  `<div class="ph ${cls} ${extra}" data-reveal data-label="${IWC.esc(label)}"${ar ? ` style="--ar:${ar}"` : ''} role="img" aria-label="Placeholder: ${IWC.esc(label)}"></div>`;

/** Fill every [data-fill="<name>"] element with fn(items). */
IWC.fill = (name, html) => {
  document.querySelectorAll(`[data-fill="${name}"]`).forEach((el) => (el.innerHTML = html));
};
