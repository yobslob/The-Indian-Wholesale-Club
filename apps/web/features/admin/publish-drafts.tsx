'use client';

import { useState } from 'react';

import { publishDraftsAction } from './actions/catalog';
import { ConfirmButton } from './confirm';
import { button } from './styles';

type PublishDraftsResult = Awaited<ReturnType<typeof publishDraftsAction>>;

/** What publishing did and what held the rest, in the admin's words. */
function summary(r: PublishDraftsResult): string {
  const held = [
    r.no_photo ? `${r.no_photo} without a photo` : '',
    r.no_option ? `${r.no_option} without an active option` : '',
    r.no_stock ? `${r.no_stock} with nothing to sell (sold out, or out of stock at the shop)` : '',
    r.refused ? `${r.refused} refused by the store's checks${r.note ? ` (${r.note})` : ''}` : '',
  ].filter(Boolean);
  const lead =
    `${r.published} ${r.published === 1 ? 'draft' : 'drafts'} published.` +
    (r.live_missing_details
      ? ` ${r.live_missing_details} of them still lack details customers see (fibre and care, ingredients and allergens, or material): finish them from Products → Live.`
      : '');
  return held.length ? `${lead} Still drafts: ${held.join('; ')}.` : lead;
}

/**
 * Products → Drafts: publish every draft that is ready, in one go (D-120). Demo listings and US clearance pieces are
 * left alone; drafts without a photo, an option or a piece to sell stay drafts and are counted.
 */
export function PublishDrafts(): React.JSX.Element {
  const [result, setResult] = useState<PublishDraftsResult | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ConfirmButton
        label="Publish all drafts"
        className={button}
        title="Publish all drafts?"
        confirm="Publish them"
        danger={false}
        action={async () => setResult(await publishDraftsAction())}
      >
        Every draft with a photo, an active option and a piece to sell goes live on the store now, at its current
        price, even if a detail customers see is still empty (you get a count). Drafts missing a photo, an option or
        a piece to sell stay drafts. Demo listings and US clearance pieces are not touched.
      </ConfirmButton>
      {result ? (
        <p role="status" className="text-sm">
          {summary(result)}
        </p>
      ) : null}
    </div>
  );
}
