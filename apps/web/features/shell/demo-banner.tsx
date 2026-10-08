/**
 * The demo round (D-078): while the store shows the demo catalogue, every page says so. Nothing here is for sale and
 * payments run in Stripe's test mode, so testers pay with Stripe's test card. It sits above the header, never under it
 * (D-079); narrow screens get one short line whose "Test card" opens the card details.
 */
export function DemoBanner(): React.JSX.Element {
  return (
    <div role="note" className="site-banner bg-ink text-canvas font-ui px-4 py-2 text-center text-[13px] leading-snug">
      <span className="site-banner-long">
        <strong className="font-semibold">Demo store.</strong> Nothing here is for sale and no real money is taken. To try
        checkout, pay with the test card 4242 4242 4242 4242, any future date and any CVC.
      </span>
      <span className="site-banner-short">
        <strong className="font-semibold">Demo store.</strong> Nothing here is for sale.{' '}
        <details className="inline">
          <summary className="inline cursor-pointer list-none underline underline-offset-[3px]">Test card</summary>
          4242 4242 4242 4242, any future date, any CVC.
        </details>
      </span>
    </div>
  );
}
