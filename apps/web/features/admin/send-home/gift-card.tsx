'use client';

import { useActionState, useState } from 'react';

import { formatInr, formatUsd, upiNote, upiPayLink } from '@repo/shared/domain';

import { giftFailedAction, markGiftSentAction, type GiftActionState } from '@/features/admin/actions/send-home';
import { ConfirmButton } from '@/features/admin/confirm';
import { button, input, panel, secondaryButton } from '@/features/admin/styles';
import { SEND_HOME_WORDS } from '@/features/send-home/words';

import type { DeskGift } from '@repo/db/admin';

const W = SEND_HOME_WORDS.admin;

function Copy({ text }: { text: string }): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={secondaryButton}
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? W.copied : W.copy}
    </button>
  );
}

/**
 * One gift on the India desk's phone (plan §4.8): who and how much, the UPI to copy, the note, Pay in my UPI app (opens
 * the desk's own UPI app with everything filled in), then the reference and Mark sent; Couldn't send refunds the gift.
 */
export function GiftCard({
  gift,
  paidAgo,
  heldNote,
}: {
  gift: DeskGift;
  paidAgo: string;
  heldNote: string | null;
}): React.JSX.Element {
  const [state, action, pending] = useActionState<GiftActionState, FormData>(markGiftSentAction, { error: null });
  const inr = formatInr(gift.inr_paise);
  const usd = formatUsd(gift.usd_cents);
  const note = upiNote(gift.sender_first_name, gift.note);
  const pay = upiPayLink({ upi: gift.upi, name: gift.call_name, inrPaise: gift.inr_paise, note });
  const open = gift.status === 'to_send' || gift.status === 'on_hold';
  return (
    <article className={`${panel} space-y-3`} aria-label={`${gift.call_name}, ${inr}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-heading m-0 text-[17px] font-semibold">
            {gift.call_name}
            {gift.region_name ? (
              <span className="text-ink-muted font-ui text-[14px] font-normal"> · {gift.region_name}</span>
            ) : null}
          </p>
          <p className="font-ui text-ink-muted m-0 text-[13px]">
            for {gift.customer} ·{' '}
            <a href={`/admin/orders/${gift.order_id}`} className="underline">
              {gift.order_number}
            </a>{' '}
            · paid {paidAgo}
          </p>
        </div>
        <p className="font-display m-0 text-[24px] font-bold leading-none">{inr}</p>
      </div>
      <div className="flex items-center gap-2">
        <code className="bg-canvas border-line min-w-0 flex-1 truncate rounded-[9px] border px-3 py-2.5 text-[14px]">
          {gift.upi}
        </code>
        <Copy text={gift.upi} />
      </div>
      <p className="font-ui m-0 text-[13px]">
        <span className="text-ink-muted">Note: </span>
        {note}
      </p>
      {heldNote ? <p className="font-ui text-caution m-0 text-[13px] font-semibold">{heldNote}</p> : null}
      {gift.status === 'sent' ? <p className="font-ui m-0 text-[13px]">UTR {gift.utr}</p> : null}
      {gift.failed_reason ? <p className="font-ui text-ink-muted m-0 text-[13px]">{gift.failed_reason}</p> : null}
      {open && !gift.held ? (
        <>
          {pay ? (
            <a href={pay} className={`${button} w-full`}>
              {W.pay(inr)}
            </a>
          ) : (
            <p className="font-ui text-ink-muted m-0 text-[13px]">{W.payByNumber}</p>
          )}
          <form action={action} className="flex gap-2">
            <input type="hidden" name="giftId" value={gift.id} />
            <label className="sr-only" htmlFor={`utr-${gift.id}`}>
              {W.utr}
            </label>
            <input
              id={`utr-${gift.id}`}
              name="utr"
              autoComplete="off"
              placeholder={W.utr}
              className={input}
              required
            />
            <button type="submit" className={button} disabled={pending}>
              {pending ? 'Saving…' : W.markSent}
            </button>
          </form>
          {state.error ? (
            <p role="alert" className="font-ui text-danger m-0 text-[13px]">
              {state.error}
            </p>
          ) : null}
        </>
      ) : null}
      {open ? (
        <ConfirmButton
          label={W.failed(usd)}
          title="Couldn't send"
          confirm={`Refund ${usd}`}
          action={giftFailedAction.bind(null, gift.id, 'Could not send: wrong or closed UPI')}
          mail={{
            subject: SEND_HOME_WORDS.emails.failedSubject(inr, gift.call_name),
            text: SEND_HOME_WORDS.emails.failedBody(inr, gift.call_name, usd),
          }}
        >
          {W.failedConfirm(usd)}
        </ConfirmButton>
      ) : null}
    </article>
  );
}
