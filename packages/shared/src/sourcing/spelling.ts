/**
 * Shops' common misspellings, fixed as a listing is imported (launch QA B-9: "Cotten Blend" reached a product page).
 * Whole words only, the shop's case kept ("Cotten" → "Cotton", "COTTEN" → "COTTON"). Used by the importer's clean-up
 * (cleanTitle, cleanOptions) for new imports only: rows already saved are never rewritten (D-012). Add a word here
 * only when it can never be a brand or a real word.
 */
const FIXES: Record<string, string> = {
  cotten: 'cotton',
  cottan: 'cotton',
  georgete: 'georgette',
  gorgette: 'georgette',
  jorjet: 'georgette',
  chiffion: 'chiffon',
  chifon: 'chiffon',
  polyster: 'polyester',
  polyestor: 'polyester',
  velvat: 'velvet',
  embriodered: 'embroidered',
  embroidred: 'embroidered',
  embrodered: 'embroidered',
  embroided: 'embroidered',
  embroidary: 'embroidery',
  embroidry: 'embroidery',
  desiner: 'designer',
  desinger: 'designer',
  traditonal: 'traditional',
  tradtional: 'traditional',
  jewellary: 'jewellery',
  jwellery: 'jewellery',
  premuim: 'premium',
  stainles: 'stainless',
  stainlees: 'stainless',
  handcrafed: 'handcrafted',
  printd: 'printed',
  pritned: 'printed',
};

const WORD = new RegExp(`\\b(${Object.keys(FIXES).join('|')})\\b`, 'gi');

/** The fix in the case the shop wrote the word: all capitals, a capital first, or lower case. */
function inCase(found: string, fix: string): string {
  if (found === found.toUpperCase()) return fix.toUpperCase();
  if (found[0] === found[0]!.toUpperCase()) return fix[0]!.toUpperCase() + fix.slice(1);
  return fix;
}

/** The text with each known misspelling fixed. */
export function fixSpelling(text: string): string {
  return text.replace(WORD, (found) => inCase(found, FIXES[found.toLowerCase()] ?? found));
}
