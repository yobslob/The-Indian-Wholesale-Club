import { SEND_HOME_WORDS } from './words';

const W = SEND_HOME_WORDS.saved;
const coinsOf = (cents: number): string => cents.toLocaleString('en-US');

/**
 * D-208: what happened to an order's 5% saving when it did not go home: Coins added (or waiting for a guest's account),
 * Coins because the desk could not send it, or taken back with a cancelled order. A sent-home saving shows its postcard
 * or gift card instead.
 */
export function SavingNote({
  cents,
  credited,
  giftFailed = false,
  takenBack = false,
  name = null,
}: {
  cents: number;
  credited: boolean;
  giftFailed?: boolean;
  takenBack?: boolean;
  name?: string | null;
}): React.JSX.Element {
  const coins = coinsOf(cents);
  const text = takenBack ? W.takenBack : giftFailed && name ? W.fromGift(coins, name) : credited ? W.kept(coins) : W.keptGuest(coins);
  return (
    <section aria-label={W.kicker} className="bg-paper border-brand/60 grid gap-1.5 rounded-[18px] border p-4">
      <p className="font-ui text-ink-muted m-0 text-[10px] font-bold uppercase tracking-[0.14em]">{W.kicker}</p>
      <p className="font-heading text-ink m-0 text-[16px] font-semibold">{text}</p>
    </section>
  );
}
