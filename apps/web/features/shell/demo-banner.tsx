/**
 * The demo round (D-078): while the store shows the demo catalogue, every page says so. Nothing here is for sale and
 * payments run in Stripe's test mode, so testers pay with Stripe's test card.
 */
export function DemoBanner(): React.JSX.Element {
  return (
    <div role="note" className="bg-ink text-canvas font-ui px-4 py-2 text-center text-[13px] leading-snug">
      <strong className="font-medium">Demo store.</strong> Nothing here is for sale and no real money is taken. To try
      checkout, pay with the test card 4242 4242 4242 4242, any future date and any CVC.
    </div>
  );
}
