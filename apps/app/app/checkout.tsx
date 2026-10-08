import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { listMyAddresses } from '@repo/db/account';
import { formatUsd, formatUsPhone } from '@repo/shared/domain';

import type { BagLine } from '@/features/cart/store';
import type { Details } from '@/features/checkout/request';
import type { CheckoutOutcome } from '@/features/checkout/use-checkout';
import type { CheckoutQuote } from '@repo/shared/domain';

import { Body, Button, ErrorText, Screen } from '@/components/ui';
import { bagCount, bagSubtotalCents, useBag } from '@/features/cart/store';
import { BagSummary } from '@/features/checkout/bag-summary';
import { ShippingOptions } from '@/features/checkout/quote-summary';
import { EMPTY_DETAILS, toCheckoutRequest } from '@/features/checkout/request';
import { DeliveryStep, PhoneStep, Step } from '@/features/checkout/steps';
import { useCheckout } from '@/features/checkout/use-checkout';
import { DemoBanner } from '@/features/shell/demo-banner';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

/** "Meera Nair · 12 Oak St, Edison, NJ 08817" for the folded delivery step. */
const deliveryLine = (d: Details): string => `${d.fullName} · ${d.line1}${d.line2 ? ` ${d.line2}` : ''}, ${d.city}, ${d.state} ${d.zipCode}`;

/**
 * Checkout (D-087, D-095): 1. phone → 2. delivery → 3. payment on one screen, each opening when the one before is
 * done and folding to a line with Edit; the bag bar at the top opens the bag. Continue to payment prices the bag on
 * the server and readies Stripe's PaymentSheet (native) for that exact total; Pay presents it. The thank-you screen
 * shows the pieces, the total and the delivery window.
 */
export default function CheckoutScreen(): React.JSX.Element {
  const router = useRouter();
  const { session } = useSession();
  const lines = useBag((s) => s.lines);
  const clear = useBag((s) => s.clear);
  const checkout = useCheckout();
  const [at, setAt] = useState<1 | 2 | 3>(1);
  const [phone, setPhone] = useState('');
  const [details, setDetails] = useState<Details>(EMPTY_DETAILS);
  const [formError, setFormError] = useState<string | null>(null);
  const [bagOpen, setBagOpen] = useState(false);
  const [done, setDone] = useState<{ outcome: CheckoutOutcome; lines: BagLine[]; quote: CheckoutQuote } | null>(null);

  // Signed in: start from the account email and the default address (and its phone).
  useEffect(() => {
    if (!session) return;
    let active = true;
    const email = session.user.email ?? '';
    void listMyAddresses(supabase)
      .then((rows) => rows[0])
      .catch(() => undefined)
      .then((a) => {
        if (!active) return;
        setDetails((d) =>
          d.line1
            ? d
            : { ...d, email: d.email || email, ...(a ? { fullName: a.full_name, line1: a.line1, line2: a.line2 ?? '', city: a.city, state: a.state, zipCode: a.zip_code } : {}) },
        );
      });
    return () => {
      active = false;
    };
  }, [session]);

  if (done) {
    const { outcome } = done;
    const track = (): void =>
      outcome.kind === 'placed' && session
        ? router.replace({ pathname: '/order/[number]', params: { number: outcome.orderNumber } })
        : router.replace({ pathname: '/order/lookup', params: outcome.kind === 'placed' ? { number: outcome.orderNumber, email: outcome.email } : {} });
    return (
      <Screen title="Thank you">
        <Text accessibilityRole="header" className="font-heading text-[32px] leading-[36px] text-[#1D1A17]">
          Thank you!
        </Text>
        {outcome.kind === 'placed' ? (
          <Body>
            Your order number is <Text className="font-ui-semibold">{outcome.orderNumber}</Text>. We have emailed your confirmation to {outcome.email} with the
            estimated delivery window.
          </Body>
        ) : (
          <Body>{outcome.message || 'Your payment went through. We will email you shortly.'}</Body>
        )}
        <BagSummary title="Your order" lines={done.lines} quote={done.quote} />
        <Button label="Track this order" onPress={track} />
        <Button kind="link" label="Keep browsing" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  if (lines.length === 0) {
    return (
      <Screen title="Checkout">
        <Body muted>Your bag is empty.</Body>
        <Button kind="link" label="Find something from home" onPress={() => router.replace('/explore')} />
      </Screen>
    );
  }

  async function continueToPayment(): Promise<void> {
    setFormError(null);
    const result = toCheckoutRequest({ ...details, phone: phone ? formatUsPhone(phone) : '' }, lines, checkout.request?.shippingMethod ?? 'standard');
    if ('error' in result) return setFormError(result.error);
    await checkout.start(result.body);
    setAt(3);
  }

  async function pay(): Promise<void> {
    const snapshot = { lines, quote: checkout.started?.quote };
    const result = await checkout.pay();
    if (result && snapshot.quote) {
      clear();
      setDone({ outcome: result, lines: snapshot.lines, quote: snapshot.quote });
    }
  }

  const edit = (step: 1 | 2) => (): void => {
    checkout.edit();
    setAt(step);
  };
  const stateOf = (n: 1 | 2 | 3): 'open' | 'done' | 'later' => (n === at ? 'open' : n < at ? 'done' : 'later');
  const quote = checkout.started?.quote ?? null;
  const total = quote ? quote.breakdown.totalCents : bagSubtotalCents(lines);
  const { started, request } = checkout;

  return (
    <Screen title="Checkout">
      <DemoBanner />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: bagOpen }}
        onPress={() => setBagOpen((o) => !o)}
        className="bg-surface min-h-[50px] flex-row items-center justify-between rounded-[16px] px-4"
      >
        <Text className="font-ui-semibold text-ink text-[15px]">
          Bag ({bagCount(lines)}) · {formatUsd(total)}
        </Text>
        <Text className="text-ink text-base">{bagOpen ? '⌃' : '⌄'}</Text>
      </Pressable>
      {bagOpen ? <BagSummary title="Your bag" lines={lines} quote={quote} /> : null}
      <View className="border-line border-b">
        <Step n={1} title="Phone" state={stateOf(1)} summary={phone ? formatUsPhone(phone) : ''} onEdit={edit(1)}>
          <PhoneStep
            value={phone}
            onDone={(digits) => {
              setPhone(digits);
              setAt(2);
            }}
          />
        </Step>
        <Step n={2} title="Delivery" state={stateOf(2)} summary={details.line1 ? deliveryLine(details) : ''} onEdit={edit(2)}>
          <DeliveryStep value={details} onChange={setDetails} busy={checkout.busy} error={formError ?? checkout.error} onDone={() => void continueToPayment()} />
        </Step>
        <Step n={3} title="Payment" state={stateOf(3)}>
          {started && request ? (
            <>
              <ShippingOptions quote={started.quote} disabled={checkout.busy} onChange={(method) => void checkout.start({ ...request, shippingMethod: method })} />
              <BagSummary title="Your bag" lines={lines} quote={started.quote} />
              {checkout.error ? <ErrorText>{checkout.error}</ErrorText> : null}
              <Button label={`Pay ${formatUsd(started.quote.breakdown.totalCents)}`} onPress={() => void pay()} disabled={checkout.busy} />
            </>
          ) : checkout.error ? (
            <ErrorText>{checkout.error}</ErrorText>
          ) : null}
        </Step>
      </View>
    </Screen>
  );
}
