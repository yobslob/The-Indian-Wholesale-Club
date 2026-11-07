/**
 * The first-order offer's words (D-193). The offer itself is the coupon WELCOME10 in Admin → Promotions, 10% up to $9 for
 * someone with no paid order (D-191): the store's pages stay cached, so they do not read it. If it changes or goes off,
 * change these words and the navbar's ads (features/shell/first-order-art.tsx) too.
 */
export const FIRST_ORDER = {
  /** Bohni: a shop's first sale of the day, the one it sells at a good price for luck. Claude's draft (D-019). */
  kicker: 'Bohni · first sale, good price',
  headline: 'Get 10% off on your first order',
  cta: 'Start your bag',
  href: '/food',
} as const;
