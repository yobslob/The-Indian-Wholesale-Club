'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { formatUsd, formatUsPhone, usPhoneDigits, type CheckoutOffers } from '@repo/shared/domain';

import { BillCard } from '@/features/cart/bill-card';
import { EmptyLine } from '@/features/cart/cart-view';
import { setOffers } from '@/features/cart/offers';
import { cartCount, cartSubtotalCents, useCart } from '@/features/cart/store';
import { useBagBill } from '@/features/cart/use-bag-bill';

import { BagSummary, billOfQuote, QuoteDelivery } from './bag-summary';
import { readCheckout, readDetails, takePaymentNotice } from './checkout-session';
import { DeliveryStep, deliverySummary, type Delivery } from './delivery-step';
import { PaymentStep } from './payment-step';
import { PhoneStep } from './phone-step';
import { SavedAddresses } from './saved-addresses';
import { Step } from './step';
import { StockProblems } from './stock-problems';
import { useCheckoutPayment } from './use-checkout-payment';

import type { SummaryLine } from './last-order';
import type { CheckoutQuote, CheckoutRequestBody, SavedAddress, SavedDetails, StockProblemLine } from './types';

const NO_DELIVERY: Delivery = { fullName: '', email: '', zipCode: '', city: '', state: '', line1: '', line2: '' };

const WIDE = '(min-width: 900px)';
const onWidth = (tell: () => void): (() => void) => {
  const m = window.matchMedia(WIDE);
  m.addEventListener('change', tell);
  return () => m.removeEventListener('change', tell);
};

/** D-192: the bag sits beside the steps from this width: below it the shipments and bill are drawn above Pay instead, never both. */
const useWide = (): boolean => useSyncExternalStore(onWidth, () => window.matchMedia(WIDE).matches, () => true);

/** D-114: the delivery form filled from a saved address. */
function deliveryFrom(a: SavedAddress | null, email: string): Delivery {
  if (!a) return { ...NO_DELIVERY, email };
  return { fullName: a.fullName, email, zipCode: a.zipCode, city: a.city, state: a.state, line1: a.line1, line2: a.line2 ?? '' };
}

/** A-8: the delivery form as it was sent with a saved checkout. */
function deliveryOf(body: Pick<CheckoutRequestBody, 'address' | 'email'>): Delivery {
  const a = body.address;
  return { fullName: a.fullName, email: body.email, zipCode: a.zipCode, city: a.city, state: a.state, line1: a.line1, line2: a.line2 ?? '' };
}

/** D-192: why the server took a coupon off once it knew the customer: said once, with the way back to the bag. */
function whyOff(code: string, quote: CheckoutQuote, offers: CheckoutOffers | null | undefined): string {
  const c = offers?.coupons.find((x) => x.code === code);
  if (quote.breakdown.promoBeatenByBulk) return `Your bulk saving is bigger than ${code}, so we kept it.`;
  if (c?.newCustomersOnly && offers && !offers.isNewCustomer) return `${code} is for a first order, so it came off.`;
  return `${code} can't be used on this order, so it came off.`;
}

/**
 * /checkout (D-087): 1. phone → 2. delivery → 3. payment on one page, each opening when the one before is done and
 * folding to a line with Edit; the bag beside them (a "Bag (n) · $…" bar on phones). Continue to payment prices the bag
 * on the server and holds one payment for that exact total (D-038); a re-price in the same visit moves its amount
 * (use-checkout-payment.ts, launch QA A-5). A refresh at Payment, or a failed 3-D Secure coming back, resumes there (A-8).
 * Signed in (D-114): the default saved address and its phone fill the steps (it opens at Delivery when the phone is
 * known), the other saved addresses can be picked, and the address of a paid order is saved (finalize.ts).
 * §10 Y-3: when it opens and on every re-price the server says each line's stock; a problem line is listed at the top
 * with Remove or Keep n, payment stays locked until the last is fixed, and fixing it prices the bag again at once.
 * D-192: coupons are chosen in the bag only. The bill here is the bag's own until the server prices it, with sales tax the
 * only line that joins; a coupon the server then refuses comes off with one sentence and the way back to the bag.
 */
export function CheckoutFlow({ saved }: { saved: SavedDetails | null }): React.JSX.Element {
  const lines = useCart((s) => s.lines);
  const bag = useBagBill(false);
  const wide = useWide();
  const [mounted, setMounted] = useState(false);
  const first = saved?.addresses[0] ?? null;
  const savedPhone = first?.phone ? usPhoneDigits(first.phone) : null;
  const [at, setAt] = useState<1 | 2 | 3>(savedPhone ? 2 : 1);
  const [phone, setPhone] = useState<string | null>(savedPhone);
  const [delivery, setDelivery] = useState<Delivery>(() => deliveryFrom(first, saved?.email ?? ''));
  const [picked, setPicked] = useState(first?.id ?? 'new');
  const [notice, setNotice] = useState<string | null>(null);
  const [couponOff, setCouponOff] = useState<string | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const [bagOpen, setBagOpen] = useState(false);

  /** The bag as the summary draws it: the server's price once priced, the device's before. */
  const summarize = (quote: CheckoutQuote | null): SummaryLine[] =>
    lines.map((l) => ({
      variantId: l.variantId,
      productName: l.productName,
      variantLabel: l.variantLabel,
      regionName: l.regionName,
      quantity: l.quantity,
      imagePath: l.imagePath,
      totalCents:
        quote?.lines.find((q) => q.variantId === l.variantId)?.totalCents ??
        l.unitPriceCents * l.quantity,
    }));
  const payment = useCheckoutPayment(summarize);
  const { started, request, busy, error } = payment;

  async function go(body: CheckoutRequestBody, heldSecret: string | null = null): Promise<void> {
    const outcome = await payment.post(body, heldSecret);
    if (outcome === 'ok') setAt(3);
    // the payment form closed: back to the step that holds Continue
    else if (outcome === 'stock') setAt((n) => (n === 3 ? 2 : n));
  }

  useEffect(() => {
    setMounted(true);
    // A-8 / A-4: resume a checkout this tab started for this same bag, with any message from a failed payment.
    const state = useCart.getState();
    const resume = readCheckout(state.lines);
    const message = takePaymentNotice();
    if (!resume) {
      if (state.lines.length > 0) void payment.checkStock(state.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })));
      // D-192: back from changing the bag: what was typed stays typed
      const details = saved ? null : readDetails();
      if (details) {
        const digits = details.address.phone ? usPhoneDigits(details.address.phone) : null;
        if (digits) setPhone(digits);
        setDelivery(deliveryOf(details));
        setFormVersion((v) => v + 1);
        if (digits) setAt(2);
      }
      return;
    }
    const digits = resume.request.address.phone
      ? usPhoneDigits(resume.request.address.phone)
      : null;
    if (digits) setPhone(digits);
    setDelivery(deliveryOf(resume.request));
    setFormVersion((v) => v + 1);
    setNotice(message);
    setAt(2);
    // the coupon is the bag's: it may have changed since this payment was held, whose amount then moves
    void go({ ...resume.request, promoCode: state.promoCode, useCoins: true }, resume.clientSecret);
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Each priced answer knows the customer better than the bag did: their offers, and whether the coupon stays.
  const quote = started?.quote ?? null;
  const told = useRef<CheckoutQuote | null>(null);
  useEffect(() => {
    if (!quote || told.current === quote) return;
    told.current = quote;
    if (quote.offers) setOffers(quote.offers);
    const code = request?.promoCode;
    if (quote.promoRejected && code) {
      setCouponOff(whyOff(code, quote, quote.offers));
      useCart.getState().setPromoCode(null);
    }
  }, [quote, request]);

  if (!mounted) return <p className="text-ink-muted text-sm">Loading your bag…</p>;
  if (lines.length === 0 && !started) return <EmptyLine />;

  const summaryLines = summarize(quote);

  function priceWith(d: Delivery): void {
    setDelivery(d);
    setCouponOff(null);
    void go({
      email: d.email,
      address: {
        fullName: d.fullName,
        line1: d.line1,
        line2: d.line2 || null,
        city: d.city,
        state: d.state,
        zipCode: d.zipCode,
        phone: phone ? formatUsPhone(phone) : null,
      },
      lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
      // what counts on the bag; with no offers to judge by, the server decides
      promoCode: bag.offers ? (bag.coupon?.code ?? null) : bag.picked,
      useCoins: true,
    });
  }

  /** Y-3: Remove (keep 0) or Keep n. The bag changes at once; with the last line fixed the server prices it again. */
  function fixLine(line: StockProblemLine, keep: number): void {
    const cart = useCart.getState();
    if (keep > 0) cart.setQuantity(line.variantId, keep);
    else cart.remove(line.variantId);
    const rest = payment.stockFixed(line.variantId);
    const left = useCart.getState().lines;
    if (left.length === 0) return payment.drop();
    if (rest.length === 0 && request) {
      void go({ ...request, lines: left.map((l) => ({ variantId: l.variantId, quantity: l.quantity })) });
    }
  }

  const edit = (step: 1 | 2) => () => {
    payment.drop();
    setNotice(null);
    setAt(step);
  };
  const stateOf = (n: 1 | 2 | 3): 'open' | 'done' | 'later' =>
    n === at ? 'open' : n < at ? 'done' : 'later';
  const subtotal = cartSubtotalCents(lines);
  const total = quote ? quote.breakdown.totalCents : (bag.bill?.totalCents ?? subtotal);
  const signIn = bag.offers?.coins === null ? '/login?next=/checkout' : undefined;

  return (
    <div className="grid items-start gap-[clamp(12px,2.4vw,40px)] min-[900px]:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <aside
        aria-label="Your bag"
        className="min-[900px]:sticky min-[900px]:top-[calc(var(--top-h)+16px)] min-[900px]:order-last"
      >
        <button
          type="button"
          onClick={() => setBagOpen((o) => !o)}
          aria-expanded={bagOpen}
          className="bg-paper border-line font-ui flex min-h-[52px] w-full items-center justify-between rounded-[16px] border px-4 text-[15px] font-semibold min-[900px]:hidden"
        >
          Bag ({cartCount(lines)}) · {formatUsd(total)}
          <span
            aria-hidden="true"
            className={`transition-transform ${bagOpen ? 'rotate-180' : ''}`}
          >
            ⌄
          </span>
        </button>
        {wide || bagOpen ? (
          <div className={wide ? '' : 'mt-2'}>
            <BagSummary
              title="Your bag"
              lines={summaryLines}
              subtotalCents={subtotal}
              quote={quote}
              bill={bag.bill}
              updating={bag.updating}
              signInHref={signIn}
              linesOnly={!wide && quote !== null}
            />
          </div>
        ) : null}
      </aside>
      <div>
        <StockProblems problems={payment.stock} bag={lines} busy={busy} onFix={fixLine} />
        <Step
          n={1}
          title="Phone"
          state={stateOf(1)}
          summary={phone ? formatUsPhone(phone) : ''}
          onEdit={edit(1)}
        >
          <PhoneStep
            value={phone}
            onDone={(digits) => {
              setPhone(digits);
              setAt(2);
            }}
          />
        </Step>
        <Step
          n={2}
          title="Delivery"
          state={stateOf(2)}
          summary={delivery.line1 ? deliverySummary(delivery) : ''}
          onEdit={edit(2)}
        >
          <SavedAddresses
            addresses={saved?.addresses ?? []}
            picked={picked}
            onPick={(a) => {
              setPicked(a?.id ?? 'new');
              setDelivery((d) => deliveryFrom(a, d.email));
              const digits = a?.phone ? usPhoneDigits(a.phone) : null;
              if (digits) setPhone(digits);
            }}
          />
          {/* Keyed by the pick (and a resumed checkout): the form's fields start from that address. */}
          <DeliveryStep
            key={`${picked}-${formVersion}`}
            value={delivery}
            busy={busy}
            error={error}
            onDone={priceWith}
          />
        </Step>
        <Step n={3} title="Payment" state={stateOf(3)}>
          {couponOff ? (
            <p role="status" className="bg-caution/10 text-ink font-ui mb-3 rounded-[14px] px-3.5 py-2.5 text-sm">
              {couponOff}{' '}
              <Link href="/cart" className="font-semibold underline underline-offset-[3px]">
                Choose another in your bag
              </Link>
            </p>
          ) : null}
          {/* D-192: the bag is folded on a phone: the shipments and the bill, right above Pay */}
          {quote && !wide ? (
            <div className="mb-4 grid gap-3">
              <QuoteDelivery quote={quote} lines={summaryLines} />
              <BillCard bill={billOfQuote(quote)} subtotalCents={subtotal} />
            </div>
          ) : null}
          <PaymentStep
            payment={payment}
            delivery={delivery}
            phone={phone}
            notice={notice}
            onPrice={(body) => void go(body)}
          />
        </Step>
      </div>
    </div>
  );
}
