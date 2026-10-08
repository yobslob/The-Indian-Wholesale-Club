import { h, p, ul, type Block, type InfoSlug } from './blocks';
import { cancelSentence, dayRange, returnTiers, standardShipping, taxSentence, type InfoPolicy } from './policy';

/**
 * The seven info pages' wording, moved unchanged from the website's components (B6, D-095). Every line keeps its
 * status: How it works, FAQ, Shipping & returns, Privacy and Terms are Claude drafts awaiting the founder (D-019),
 * Privacy and Terms also a lawyer; the About story is the founder's to write. Nothing about shops or sourcing (D-003).
 * Numbers come from store_policy() (D-008); the support email from the site's settings (Q-9).
 */
export interface InfoInputs {
  /** Needed by FAQ and Shipping & returns, which state the numbers; the other five state none. */
  policy?: InfoPolicy;
  /** The support address, or null until it is set (Q-9). */
  email?: string | null;
}

// TODO(founder): the About story (design.md voice). Claude-written text would be a draft (D-019).
const about = (): Block[] => [{ kind: 'p', parts: ['This page is being written.'], muted: true }];

// TODO(founder): approve this copy (draft, D-019). It speaks as the seller and never about operations (D-003).
const howItWorks = (): Block[] => [
  {
    kind: 'ol',
    items: [
      ['Pick your state, or any state you miss.'],
      ['Choose its clothing and spices.'],
      ['Before you pay, you see the estimated delivery window for your order.'],
      ['We deliver to your door in the US and keep you updated until it arrives.'],
    ],
  },
];

/**
 * FAQ: answers restate the decisions (D-001, D-002, D-004, D-008, D-036, D-066, D-070 – D-073, D-076) with the numbers
 * from store_policy(). TODO(founder): approve this draft (written by Claude; design.md voice).
 */
function faq(policy: InfoPolicy): Block[] {
  const express = dayRange(policy.express_days_min, policy.express_days_max);
  const tiers = returnTiers(policy);
  const lastTier = policy.return_tiers.at(-1);
  const returns: Block[] = [];
  if (policy.return_claim_days !== null)
    returns.push(p(`If a piece arrives damaged or is not what you ordered, tell us from your order page within ${policy.return_claim_days} days of delivery and you get everything back.`));
  if (tiers && lastTier)
    returns.push(p(`Changed your mind? Unworn, unaltered clothing can come back: we keep ${tiers} of delivery, for bringing it back. After ${lastTier.days} days, returns are closed. Food and spices are final sale.`));
  returns.push(p('We collect the piece from your door, just as it was delivered.'));
  return [
    {
      kind: 'qa',
      items: [
        { q: 'What do you sell?', a: [p("Clothing and spices from India's 28 states and 8 union territories. Pick the state you miss, or any state you love, and shop what it is known for.")] },
        { q: 'Where do the pieces come from?', a: [p('Every piece is made in India. Its page shows the state it comes from, and it is imported to the US for your order.')] },
        {
          q: 'When will my order arrive?',
          a: [p(`Before you pay, you see the estimated delivery window for your order, and it is on every product page too.${express ? ` Express arrives in about ${express} from your order.` : ''} If the date moves, we email you the new one.`)],
        },
        { q: 'How much is shipping?', a: [p(`Standard shipping is ${standardShipping(policy)}. Express, when offered, depends on your bag and is shown at checkout. We deliver in the US only.`)] },
        { q: 'Do you charge sales tax?', a: [p(taxSentence(policy.tax))] },
        { q: 'What currency do you charge in?', a: [p('US dollars. Shipping and any sales tax are shown at checkout, before you pay.')] },
        {
          q: 'How do I follow my order?',
          a: [p('Your order email links to your order page, or find it with your order number and email on ', { link: 'Track your order', to: '/orders/lookup' }, '. We email you at every step, with a tracking link once it ships.')],
        },
        { q: 'My delivery date moved. What can I do?', a: [p('Keep your order with the new date, or cancel it and get everything back, from your order page.')] },
        { q: 'Can I cancel?', a: [p(cancelSentence(policy))] },
        { q: 'Can I return something?', a: returns },
        { q: 'When do I get my refund?', a: [p('We refund your card as soon as a cancel goes through, or once a returned piece reaches us. Banks usually take 5 to 10 days to show it.')] },
      ],
    },
    { kind: 'p', parts: ['More on ', { link: 'shipping and returns', to: '/shipping-returns' }, '.'], muted: true, small: true },
  ];
}

/**
 * Shipping & returns: every number from store_policy(), so a change in the admin changes this page too (D-008).
 * TODO(founder): approve this draft (written by Claude from D-070 – D-073, D-076 and D-008; design.md voice).
 */
function shippingReturns(policy: InfoPolicy): Block[] {
  const express = dayRange(policy.express_days_min, policy.express_days_max);
  const usDays = dayRange(policy.us_delivery_days_min, policy.us_delivery_days_max);
  const tiers = returnTiers(policy);
  const lastTier = policy.return_tiers.at(-1);
  const delivery = [[{ strong: 'Standard' }, `: ${standardShipping(policy)}. The window is on every product page and at checkout.`]];
  if (express) delivery.push([{ strong: 'Express' }, `: about ${express} from your order, sent straight to your door. Its price depends on your bag and is shown at checkout.`]);
  if (usDays) delivery.push([{ strong: 'Already in the US' }, `: some pieces are marked so on their page. On their own they arrive in about ${usDays}.`]);
  const returns = [];
  if (policy.return_claim_days !== null)
    returns.push([{ strong: 'Damaged or not what you ordered' }, `: tell us from your order page within ${policy.return_claim_days} days of delivery and you get everything back, shipping included.`]);
  if (tiers && lastTier)
    returns.push([{ strong: 'Changed your mind' }, `: unworn, unaltered clothing can come back. We keep part of the price for bringing it back: ${tiers} of delivery. After ${lastTier.days} days, returns are closed.`]);
  returns.push([{ strong: 'Food and spices' }, ' are final sale, unless they arrive damaged or are not what you ordered.']);
  return [
    h('Delivery'),
    p('Every piece is made in India and comes to you from there. Before you pay, you see the estimated delivery window for your order, and we tell you if it changes.'),
    ul(...delivery),
    p(`We deliver in the US only. ${taxSentence(policy.tax)}`),
    h('If your delivery date moves'),
    p('We email you the new window. You can keep your order with the new date, or cancel it and get everything back, from your order page.'),
    h('Cancelling'),
    p(cancelSentence(policy)),
    h('Returns'),
    ul(...returns),
    p('Your order page shows what you would get back before you ask. We collect the piece from your door, just as it was delivered, and the refund goes to your card once it reaches us. Banks usually take 5 to 10 days to show it.'),
  ];
}

/** Contact: the support address from the site's settings. TODO(founder): Q-9 (domain + support email). */
const contact = (email: string | null): Block[] =>
  email
    ? [p('Write to us at ', { link: email, to: `mailto:${email}` }, '. Include your order number if you have one.')]
    : [{ kind: 'p', parts: ['Contact details are coming soon.'], muted: true }];

/**
 * Privacy. A DRAFT written by Claude from what the code actually does (checked 2026-10-06; the ZIP lookup and the
 * required phone added 2026-10-08, D-087, D-098). Keep it true when any of that changes.
 * TODO(founder): approve with a lawyer; how long records are kept (B-23) and the company contact details (Q-9).
 */
const privacy = (email: string | null): Block[] => [
  p('The Indian Wholesale Club is a New Jersey business. This page says what we collect when you shop with us, why, and who else sees it.'),
  h('What we collect'),
  ul(
    [{ strong: 'Your order' }, ': your email, name, delivery address and what you bought. If you make an account, also your saved addresses, saved items and, if you add one, your phone number.'],
    [{ strong: 'Payment' }, ': handled by Stripe. We never see or store your full card number.'],
    [{ strong: 'Reviews' }, ': what you write, the name you choose to show and any photos you add. Nothing appears before we approve it.'],
    [{ strong: 'Searches' }, ': the words searched on the site and how many results they found, without who searched, so we know what to stock.'],
    [{ strong: 'Protection against abuse' }, ': a scrambled form of your internet address (never the address itself), counted for a minute to stop too many requests in a row and cleared out after about an hour.'],
  ),
  h('In your browser'),
  p('Your bag is kept in your own browser until you check out. If you sign in, a cookie keeps you signed in. We use no advertising or analytics trackers.'),
  h('Why we use it'),
  p('To take your payment, deliver your order, email you about it, handle cancels, returns and refunds, answer you when you write to us, and keep the site safe. We do not sell your information.'),
  h('Who else sees it'),
  p('Only the companies that help us run the shop, for that job: Stripe (payments), Supabase (our database), Vercel (the website), Resend (our emails) and the couriers who deliver your order or collect a return, who get your name, address and phone number.'),
  p('When you type your ZIP code at checkout, we fill in the city and state from our own copy of the ', { link: 'GeoNames', to: 'https://www.geonames.org/' }, ' postal code list (CC BY 4.0), so your ZIP code goes to no one else.'),
  h('Your choices'),
  p(
    'You can ask us what we hold about you, to correct it, or to delete it, except what the law requires us to keep about orders and payments.',
    ...(email ? [' Write to ', { link: email, to: `mailto:${email}` }, '.'] : []),
  ),
];

/**
 * Terms of sale. A DRAFT written by Claude that restates the decisions the shop already runs on (D-001, D-004, D-008,
 * D-030, D-036, D-052, D-070 – D-073, D-076); it adds no rule of its own.
 * TODO(founder): approve with a lawyer, who adds what only they can: governing law and disputes, liability limits.
 */
const terms = (): Block[] => [
  p('These terms apply when you buy from The Indian Wholesale Club, a New Jersey business. We are the seller of everything on this site.'),
  h('What we sell'),
  p('Clothing and spices made in India. Each product page says which state it comes from; every piece is imported. We deliver to addresses in the US only.'),
  h('Prices and payment'),
  p('Prices are in US dollars. Shipping and any sales tax are shown at checkout before you pay. Payment is taken when you place the order. If a piece sells out while you are paying, we refund you in full and tell you why.'),
  h('Delivery'),
  p('Before you pay, you see an estimated delivery window. If it moves later, we email you, and you can keep your order with the new date or cancel it for a full refund. If a piece you ordered turns out to be unavailable, we refund it.'),
  h('Cancelling and returns'),
  p('You can cancel until your order leaves India, and return pieces after delivery, as set out on ', { link: 'Shipping & returns', to: '/shipping-returns' }, '. Your order page always shows what you would get back before you ask.'),
  h('Reviews'),
  p('We read every review before it appears. Only buyers who received the product can add photos.'),
  h('Your account'),
  p('Keep your password to yourself. You can also order without an account and follow the order with its number and email.'),
];

/** One info page's blocks. FAQ and Shipping & returns need the store policy: without it they would state wrong numbers. */
export function infoBlocks(slug: InfoSlug, { policy, email = null }: InfoInputs): Block[] {
  const needPolicy = (): InfoPolicy => {
    if (!policy) throw new Error(`The ${slug} page needs the store policy (store_policy()).`);
    return policy;
  };
  switch (slug) {
    case 'about':
      return about();
    case 'how-it-works':
      return howItWorks();
    case 'faq':
      return faq(needPolicy());
    case 'shipping-returns':
      return shippingReturns(needPolicy());
    case 'contact':
      return contact(email);
    case 'privacy':
      return privacy(email);
    case 'terms':
      return terms();
  }
}
