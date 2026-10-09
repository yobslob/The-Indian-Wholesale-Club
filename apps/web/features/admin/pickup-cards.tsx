import Image from 'next/image';

import { deskTime } from '@repo/shared/admin';

import { mediaUrl } from '@/lib/site';

import { markPickupAction } from './actions/cycles';
import { Chip } from './chips';
import { ConfirmButton } from './confirm';
import { button, myDesk, rupees, secondaryButton } from './ui';

import type { listPickups } from '@repo/db/admin';

type Pickup = Awaited<ReturnType<typeof listPickups>>[number];

const icon = (d: React.ReactNode): React.JSX.Element => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-[1.6]">
    {d}
  </svg>
);
const PHONE = icon(<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />);
const CHAT = icon(<path d="M4 20l1.5-4A8 8 0 1 1 9 19z" />);
const PIN = icon(
  <>
    <path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z" />
    <circle cx="12" cy="9" r="2.5" />
  </>,
);

/** Picked, unavailable and still-to-pick as a bar: green, red, the rest grey. */
export function Progress({ done, gone, total }: { done: number; gone: number; total: number }): React.JSX.Element {
  const pct = (n: number): string => `${total ? (n / total) * 100 : 0}%`;
  return (
    <span className="bg-line flex h-2 flex-1 overflow-hidden rounded" aria-hidden="true">
      <i className="bg-positive" style={{ width: pct(done) }} />
      <i className="bg-danger" style={{ width: pct(gone) }} />
    </span>
  );
}

/** One shop's pickups (D-096): Call, WhatsApp, Map, how far along, and a big Picked / Unavailable per piece. */
async function ShopCard({ rows, cycleId }: { rows: Pickup[]; cycleId: string }): Promise<React.JSX.Element> {
  const desk = await myDesk();
  const v = rows[0]?.vendor;
  const done = rows.filter((p) => p.status === 'picked').length;
  const gone = rows.filter((p) => p.status === 'unavailable').length;
  const digits = (n: string | null | undefined): string => (n ?? '').replace(/[^\d+]/g, '');
  const place = [v?.address, v?.town, v?.region?.name, 'India'].filter(Boolean).join(', ');
  return (
    <section className="border-line bg-paper overflow-hidden rounded-[14px] border">
      <div className="px-4 pb-2.5 pt-3.5">
        <h3 className="font-heading text-[16px] font-semibold leading-tight">{v?.shop_name ?? 'Unknown shop'}</h3>
        <p className="text-ink-muted mt-0.5 text-[13px]">{[v?.town, v?.region?.name, v?.payment_method].filter(Boolean).join(' · ')}</p>
        <div className="my-2.5 flex gap-2 [&>a]:flex-1">
          {v?.phone ? (
            <a href={`tel:${digits(v.phone)}`} className={`${secondaryButton} text-[13px] md:h-9`}>
              {PHONE}Call
            </a>
          ) : null}
          {v?.whatsapp || v?.phone ? (
            <a href={`https://wa.me/${digits(v.whatsapp ?? v.phone).replace('+', '')}`} target="_blank" rel="noreferrer" className={`${secondaryButton} text-[13px] md:h-9`}>
              {CHAT}WhatsApp
            </a>
          ) : null}
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${v?.shop_name ?? ''}, ${place}`)}`} target="_blank" rel="noreferrer" className={`${secondaryButton} text-[13px] md:h-9`}>
            {PIN}Map
          </a>
        </div>
        <p className="flex items-center gap-2.5 text-[12.5px] font-semibold">
          <span>
            {done} of {rows.length} picked{gone ? ` · ${gone} unavailable` : ''}
          </span>
          <Progress done={done} gone={gone} total={rows.length} />
        </p>
      </div>
      <ul>
        {rows.map((p) => {
          const media = p.variant?.product?.media.slice().sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)[0];
          const name = p.item?.product_name ?? 'Piece';
          return (
            <li
              key={p.id}
              className={`border-line grid grid-cols-[40px_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 border-t px-4 py-2.5 text-[14px] md:grid-cols-[44px_minmax(0,1fr)_auto] ${
                p.status === 'picked' ? 'bg-positive/[0.04]' : p.status === 'unavailable' ? 'bg-danger/[0.04]' : ''
              }`}
            >
              <span className="bg-land relative block h-[54px] w-10 overflow-hidden rounded-lg">
                {media ? <Image src={mediaUrl(media.storage_path)} alt="" fill sizes="40px" className="object-cover" /> : null}
              </span>
              <span className="min-w-0">
                <b className="block font-semibold">{name}</b>
                <small className="text-ink-muted text-[12.5px]">
                  {p.variant?.label ?? p.item?.variant_label} × {p.quantity} · {rupees(p.shop_price_paise)} · {p.item?.order?.order_number}
                </small>
              </span>
              <span className="col-span-2 flex gap-1.5 md:col-span-1 [&>*]:flex-1 md:[&>*]:flex-none">
                {p.status === 'pending' ? (
                  <>
                    <form action={markPickupAction.bind(null, p.id, 'picked', cycleId)} className="flex">
                      <button type="submit" className={`${button} w-full md:h-10 md:w-auto`}>
                        Picked
                      </button>
                    </form>
                    <ConfirmButton
                      label="Unavailable"
                      className={`${secondaryButton} w-full md:h-10 md:w-auto`}
                      title={`${name}: unavailable?`}
                      confirm="Mark unavailable"
                      action={markPickupAction.bind(null, p.id, 'unavailable', cycleId)}
                      mail={{
                        subject: `Sorry, part of order ${p.item?.order?.order_number ?? ''} isn't coming`,
                        text: 'It says the piece is no longer available, that they don’t pay for it, and that the rest of the order is still coming.',
                      }}
                    >
                      The shop doesn&apos;t have it any more. The piece leaves the order; refund it on the order page.
                    </ConfirmButton>
                  </>
                ) : p.status === 'picked' ? (
                  <span className="flex-none">
                    <Chip tone="ok">Picked{p.picked_at ? ` ${deskTime(p.picked_at, desk).main.split(', ')[1]}` : ''}</Chip>
                  </span>
                ) : (
                  <span className="flex-none">
                    <Chip tone="bad">Unavailable</Chip>
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The cycle's pickups as one card per shop (D-096), in shop order. */
export function PickupCards({ pickups, cycleId }: { pickups: Pickup[]; cycleId: string }): React.JSX.Element {
  const byShop = new Map<string, Pickup[]>();
  for (const p of pickups) byShop.set(p.vendor?.id ?? 'unknown', [...(byShop.get(p.vendor?.id ?? 'unknown') ?? []), p]);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5 md:grid-cols-[repeat(auto-fill,minmax(380px,1fr))]">
      {[...byShop.entries()].map(([key, rows]) => (
        <ShopCard key={key} rows={rows} cycleId={cycleId} />
      ))}
    </div>
  );
}
