import { parseWeight } from './weight';

import type { ProductType } from '../domain/product-types';

/**
 * D-135: IWC does not ship liquids (pickles go, even in oil). A liquid listing is archived for admins and shown to
 * customers as "Coming soon" with the heart instead of Add to bag. A liquid is: a page that says so ("Item Form:
 * Liquid"); food whose name or options state millilitres or litres, or that is a drink, syrup, oil, sauce or vinegar;
 * home & gifts that is an attar, perfume, rose water or a body or hair oil (a "500 ml" brass kalash is a vessel, not a
 * liquid, so home is never judged by its unit). Never pickles, pastes, powders or sweets.
 */

const FORM_KEY = /^(item form|form|product form|physical form)$/i;
const SOLID_FORM =
  /\b(solid|powder|paste|granules?|flakes?|whole|crystals?|tablets?|bar|stick|cream|gel|semi-?solid)\b/i;

/** What is sent whatever its unit: pickles in oil, pastes, powders, sweets and snacks. */
const NOT_LIQUID =
  /\b(pickles?|achaa?r|aachar|achaar|chutney|thokku|avakaya|uppinakayi|murabba|jam|jelly|paste|powder|podi|masala|mix|premix|candy|candies|toffee|tablets?|granules|flakes|chips|papad|namkeen|ladd?oos?|barfi|halwa|chikki|gajak|pedas?|pedhas?|sweets?|cookies|biscuits?|cake|soap|boondi|bhel|jhalmuri|mixture|bhujia|crisps?|churpi|chews?|cheese|paneer|khoya|mawa)\b/;
const FOOD_LIQUID =
  /\b(juice|sharbat|sherbet|syrup|squash|panha|vinegar|rose water|gulab jal|kewra water|soda|drinks?|beverage|milk|lassi|buttermilk|chaas|sauce|ketchup|oil|tel|liquid|tonic|essence|arak|arka)\b/;
const HOME_LIQUID =
  /\b(attar|ittar|perfume|fragrance oil|essential oil|hair oil|massage oil|body oil|rose water|gulab jal|kewra water|liquid|room spray|mist)\b/;
/** Home objects named after what they hold or burn. */
const VESSEL =
  /\b(lamp|diya|deepam|vilakku|samai|burner|diffuser|holder|stand|bottle|dispenser|container|jar|pot|kalash|lota|kettle|glass|glasses|mug|cups?|tumbler|vase)\b/;

export function liquidReason(input: {
  type: ProductType;
  name: string;
  labels?: string[];
  specs?: [string, string][];
}): string | null {
  if (input.type === 'clothing') return null;
  const form = input.specs?.find(([k]) => FORM_KEY.test(k.trim()))?.[1] ?? '';
  if (/\bliquid\b/i.test(form)) return `its page says Item Form: ${form.slice(0, 30)}`;
  if (form && SOLID_FORM.test(form)) return null;
  // how it is made, not what it is: "no palm oil", "oil free", "fried in groundnut oil", "with milk"
  const name = input.name
    .toLowerCase()
    .replace(
      /\b(no|without|zero)\s+(palm\s+)?oil\b|\boil[- ]free\b|\b(in|with|using)\s+(\w+\s+){0,3}(oil|milk)\b/g,
      ' ',
    );
  if (NOT_LIQUID.test(name)) return null;
  if (input.type === 'home') {
    if (VESSEL.test(name)) return null;
    const m = name.match(HOME_LIQUID);
    return m ? `its name says "${m[0]}"` : null;
  }
  const m = name.match(FOOD_LIQUID);
  if (m) return `its name says "${m[0]}"`;
  for (const text of [...(input.labels ?? []), input.name]) {
    if (parseWeight(text)?.liquid)
      return `its label is in millilitres or litres ("${text.slice(0, 40)}")`;
  }
  return null;
}
