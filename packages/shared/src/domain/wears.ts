/**
 * Who a clothing piece is for (D-140, plan F2): the vendor screens' four words (D-102). Customers filter by Women or
 * Men (unisex pieces show under both); Kids is kept but not offered at launch (founder: "no kids at launch").
 * `wearsFromName` mirrors the database's _wears_from_name() (migration 20261018100000), which fills it on save.
 */
export const WEARS = ['women', 'men', 'kids', 'unisex'] as const;
export type Wears = (typeof WEARS)[number];

export const WEARS_LABEL: Record<Wears, string> = {
  women: 'Women',
  men: 'Men',
  kids: 'Kids',
  unisex: 'Everyone (unisex)',
};

const rules: [RegExp, Wears][] = [
  [/\b(kids?|kid's|boys?|boy's|girls?|girl's|baby|babies|infants?|toddlers?|children|child)\b/i, 'kids'],
  [/\bunisex\b/i, 'unisex'],
  [/\b(women|womens|women's|woman|ladies|lady|female)\b/i, 'women'],
  [/\b(men|mens|men's|man|gents|male)\b/i, 'men'],
  [/\b(sarees?|saris?|lehengas?|lehnga|ghagra|chaniya|blouses?|kurtis?|salwars?|anarkali|churidars?|dupattas?|palazzos?|nighty|leggings)\b/i, 'women'],
  [/\b(sherwanis?|dhotis?|lungis?|pathani|veshti)\b/i, 'men'],
];

export function wearsFromName(name: string): Wears | null {
  return rules.find(([re]) => re.test(name))?.[1] ?? null;
}

/** A shop's own field (Myntra's gender: Women, Men, Boys, Girls, Unisex) among the page's hints. */
export function wearsFromHints(hints: string[]): Wears | null {
  for (const h of hints) {
    const v = h.trim().toLowerCase();
    if (v === 'women' || v === 'men' || v === 'unisex') return v;
    if (v === 'boys' || v === 'girls' || v === 'kids') return 'kids';
  }
  return null;
}
