import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { listMyAddresses } from '@repo/db/account';
import { formatUsd } from '@repo/shared/domain';

import type { Details } from '@/features/checkout/details-form';
import type { CheckoutOutcome } from '@/features/checkout/use-checkout';

import { Body, Button, ErrorText, Heading, Screen, Title } from '@/components/ui';
import { useBag } from '@/features/cart/store';
import { DetailsForm, EMPTY_DETAILS, toCheckoutRequest } from '@/features/checkout/details-form';
import { QuoteSummary, ShippingOptions } from '@/features/checkout/quote-summary';
import { useCheckout } from '@/features/checkout/use-checkout';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

/** Checkout: details → server-priced summary + delivery window → PaymentSheet → order. */
export default function CheckoutScreen(): React.JSX.Element {
  const router = useRouter();
  const { session } = useSession();
  const lines = useBag((s) => s.lines);
  const clear = useBag((s) => s.clear);
  const checkout = useCheckout();
  const [details, setDetails] = useState<Details>(EMPTY_DETAILS);
  const [formError, setFormError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<CheckoutOutcome | null>(null);

  // Signed in: start from the account email and the default address.
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
            : {
                ...d,
                email: d.email || email,
                ...(a
                  ? {
                      fullName: a.full_name,
                      line1: a.line1,
                      line2: a.line2 ?? '',
                      city: a.city,
                      state: a.state,
                      zipCode: a.zip_code,
                      phone: a.phone ?? '',
                    }
                  : {}),
              },
        );
      });
    return () => {
      active = false;
    };
  }, [session]);

  if (outcome) {
    const track = () =>
      outcome.kind === 'placed' && session
        ? router.replace({ pathname: '/order/[number]', params: { number: outcome.orderNumber } })
        : router.replace({
            pathname: '/order/lookup',
            params:
              outcome.kind === 'placed'
                ? { number: outcome.orderNumber, email: outcome.email }
                : {},
          });
    return (
      <Screen>
        <Title>Thank you</Title>
        {outcome.kind === 'placed' ? (
          <>
            <Body>Your order {outcome.orderNumber} is confirmed.</Body>
            <Body muted>We emailed a confirmation to {outcome.email}.</Body>
          </>
        ) : (
          <Body>{outcome.message || 'Your payment went through. We will email you shortly.'}</Body>
        )}
        <Button label="Track this order" onPress={track} />
        <Button kind="link" label="Keep shopping" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  if (lines.length === 0) {
    return (
      <Screen>
        <Title>Checkout</Title>
        <Body muted>Your bag is empty.</Body>
        <Button
          kind="link"
          label="Find something from home"
          onPress={() => router.replace('/explore')}
        />
      </Screen>
    );
  }

  async function continueToPayment(): Promise<void> {
    setFormError(null);
    const result = toCheckoutRequest(
      details,
      lines,
      checkout.request?.shippingMethod ?? 'standard',
    );
    if ('error' in result) setFormError(result.error);
    else await checkout.start(result.body);
  }

  async function pay(): Promise<void> {
    const result = await checkout.pay();
    if (result) {
      clear();
      setOutcome(result);
    }
  }

  const { started, request } = checkout;
  if (started && request) {
    return (
      <Screen>
        <Title>Checkout</Title>
        <QuoteSummary quote={started.quote} />
        <ShippingOptions
          quote={started.quote}
          disabled={checkout.busy}
          onChange={(method) => void checkout.start({ ...request, shippingMethod: method })}
        />
        {checkout.error ? <ErrorText>{checkout.error}</ErrorText> : null}
        <Button
          label={`Pay ${formatUsd(started.quote.breakdown.totalCents)}`}
          onPress={() => void pay()}
          disabled={checkout.busy}
        />
        <Button kind="link" label="Change details" onPress={checkout.edit} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Checkout</Title>
      <Heading>Shipping to</Heading>
      <DetailsForm value={details} onChange={setDetails} />
      {formError || checkout.error ? <ErrorText>{formError ?? checkout.error}</ErrorText> : null}
      <Button
        label={checkout.busy ? 'Checking your bag…' : 'Continue to payment'}
        onPress={() => void continueToPayment()}
        disabled={checkout.busy}
      />
      <Body muted>
        US addresses only. You will see the total and delivery window before paying.
      </Body>
    </Screen>
  );
}
