import Image from 'next/image';
import Link from 'next/link';

import { siteLabel } from '@repo/shared/sourcing';

import { mediaUrl } from '@/lib/site';

import { markExpressPickupAction } from '../actions/orders';
import { PickedWeightInput, WeighPicked } from '../hub-weigh';
import { button, Empty, rupees, When } from '../ui';

import { waited } from './group';
import { UnorderButton } from './unorder-button';

import type { PipelinePiece } from '@repo/db/admin';

/**
 * The India desk's pieces after ordering (D-140, F3; D-130): **On the way** (ordered, not at the hub: Picked with its
 * weight when it arrives) and **To weigh** (at the hub, not weighed yet). Each row links to its order.
 */
export function PipelineList({ rows, view }: { rows: PipelinePiece[]; view: 'ordered' | 'weigh' }): React.JSX.Element {
  if (rows.length === 0)
    return <Empty>{view === 'ordered' ? 'Nothing on the way: every ordered piece has reached the hub.' : 'Every piece at the hub is weighed.'}</Empty>;
  return (
    <ul className="border-line bg-paper divide-line divide-y rounded-[14px] border">
      {rows.map((p) => {
        const product = p.variant?.product;
        const media = product?.media.slice().sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)[0];
        const name = p.item.product_name;
        const site = p.source?.site ?? product?.source_site ?? null;
        return (
          <li key={p.id} className="grid grid-cols-[40px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-4 py-2.5 text-[14px] md:grid-cols-[40px_minmax(0,1fr)_auto]">
            <span className="bg-land relative block h-[54px] w-10 overflow-hidden rounded-lg">
              {media ? <Image src={mediaUrl(media.storage_path)} alt="" fill sizes="40px" className="object-cover" /> : null}
            </span>
            <span className="min-w-0">
              <b className="block font-semibold">{name}</b>
              <small className="text-ink-muted block text-[12.5px]">
                {p.variant?.label ?? p.item.variant_label} × {p.quantity} ·{' '}
                <Link href={`/admin/orders/${p.item.order.id}`} className="underline">
                  {p.item.order.order_number}
                </Link>
                {site ? ` · ${siteLabel(site)}` : ''}
                {p.paid_paise !== null ? ` · ${rupees(p.paid_paise)} paid` : ''}
                {p.shop_order_ref ? ` · ${p.shop_order_ref}` : ''}
              </small>
              <small className="text-ink-muted block text-[12.5px]">
                {view === 'ordered' && p.ordered_at ? (
                  <>
                    Ordered {waited(p.ordered_at)} ago
                    {p.source?.delivery_days != null ? `; the shop said ${p.source.delivery_days} day${p.source.delivery_days === 1 ? '' : 's'}` : ''}
                  </>
                ) : p.picked_at ? (
                  <>
                    At the hub since <When iso={p.picked_at} inline />
                  </>
                ) : null}
              </small>
            </span>
            <span className="col-span-2 md:col-span-1">
              {view === 'ordered' ? (
                <span className="flex flex-col items-start gap-1 md:items-end">
                  <form action={markExpressPickupAction.bind(null, p.id, 'picked', p.item.order.id)} className="flex gap-1.5">
                    {/* D-130: weighed as it arrives (optional): the listing is repriced on the scale's weight */}
                    <PickedWeightInput label={name} />
                    <button type="submit" className={button}>
                      At the hub
                    </button>
                  </form>
                  <UnorderButton pickupId={p.id} orderId={p.item.order.id} />
                </span>
              ) : (
                <WeighPicked pickupId={p.id} weighedG={p.weighed_g} note={p.weigh_note} label={name} path="/admin/to-order" />
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
