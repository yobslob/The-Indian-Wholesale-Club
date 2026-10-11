'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, useTransition } from 'react';

import {
  bookmarkletHref,
  decodeCapturePayload,
  normalizeCapture,
  siteLabel,
  sourcedProductSchema,
  type SourcedProduct,
} from '@repo/shared/sourcing';

import { button, panel, secondaryButton } from '../styles';

import { readLinksAction, type ImportResult } from './actions';
import { ReviewForm, type ImportFormData } from './review-form';

const QUEUE_KEY = 'iwc-import-queue';
type Saved = Extract<ImportResult, { id: string }> & { name: string };

/** The queue survives a reload of the tab (this browser only; nothing is saved until a product is saved). */
function loadQueue(): SourcedProduct[] {
  try {
    const parsed = sourcedProductSchema
      .array()
      .safeParse(JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]'));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}
function storeQueue(queue: SourcedProduct[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // private window or full storage: the queue lives only in this page
  }
}

/** The bookmark to drag to the bookmarks bar; its address is made in the browser, for this site. */
function Bookmark(): React.JSX.Element {
  const [href, setHref] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => setHref(bookmarkletHref(window.location.origin)), []);
  const html = href
    ? `<a href="${href.replace(/"/g, '%22')}" class="font-ui bg-brand text-on-brand inline-flex h-10 items-center rounded-[10px] px-4 font-semibold">+ Add to IWC</a>`
    : '';
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* A javascript: link React will not render itself; clicking it here does nothing (it is for dragging). */}
      <span onClickCapture={(e) => e.preventDefault()} dangerouslySetInnerHTML={{ __html: html }} />
      <button
        type="button"
        className={secondaryButton}
        disabled={!href}
        onClick={() => {
          navigator.clipboard.writeText(href).then(
            () => setCopied(true),
            () => setCopied(false),
          );
        }}
      >
        {copied ? 'Copied' : 'Copy its address'}
      </button>
    </div>
  );
}

/**
 * The importer (D-110): products arrive from the Add to IWC bookmark (one tab, reused) or from pasted links, wait in a
 * queue, and are checked one at a time in the review form.
 */
export function Importer({ data }: { data: ImportFormData }): React.JSX.Element {
  const [queue, setQueue] = useState<SourcedProduct[]>([]);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [links, setLinks] = useState('');
  const [reading, startReading] = useTransition();

  const add = useCallback((items: SourcedProduct[]) => {
    setQueue((q) => {
      const next = [...q.filter((p) => !items.some((i) => i.url === p.url)), ...items];
      storeQueue(next);
      return next;
    });
  }, []);
  const next = (): void =>
    setQueue((q) => {
      const rest = q.slice(1);
      storeQueue(rest);
      return rest;
    });

  useEffect(() => {
    setQueue(loadQueue());
    const take = (): void => {
      const payload = window.location.hash.match(/^#iwc=(.+)$/)?.[1];
      if (!payload) return;
      window.history.replaceState(null, '', window.location.pathname);
      const raw = decodeCapturePayload(payload);
      const product = raw ? normalizeCapture(raw) : null;
      if (product) add([product]);
      else
        setNotes((n) => [
          `No product could be read on ${raw?.url ?? 'that page'}. Open the product's own page (not a list) and try again.`,
          ...n,
        ]);
    };
    take();
    window.addEventListener('hashchange', take);
    return () => window.removeEventListener('hashchange', take);
  }, [add]);

  const read = (): void => {
    const urls = links
      .split(/\s+/)
      .filter((u) => u.startsWith('http'))
      .slice(0, 20);
    if (!urls.length) return;
    startReading(async () => {
      const results = await readLinksAction(urls);
      add(results.flatMap((r) => ('product' in r ? [r.product] : [])));
      setNotes((n) => [
        ...results.flatMap((r) => ('error' in r ? [`${r.url}: ${r.error}`] : [])),
        ...n,
      ]);
      setLinks('');
    });
  };

  const current = queue[0];
  return (
    <div className="space-y-[18px]">
      <section className={`${panel} grid gap-4 lg:grid-cols-2`} aria-label="Bring products in">
        <div className="space-y-2 text-[14px] leading-[1.45]">
          <h2 className="font-heading text-[15px] font-semibold">
            From any shop page (Myntra, Amazon, Flipkart…)
          </h2>
          <p>
            Drag this button to your bookmarks bar once. On a product&apos;s page, click it: the
            product opens here to check.
          </p>
          <Bookmark />
        </div>
        <div className="space-y-2">
          <h2 className="font-heading text-[15px] font-semibold">Or paste links</h2>
          <textarea
            value={links}
            onChange={(e) => setLinks(e.target.value)}
            rows={3}
            placeholder="One product link per line (up to 20)"
            className="border-line bg-canvas w-full rounded-[9px] border px-3 py-2 text-[14px]"
          />
          <button
            type="button"
            onClick={read}
            disabled={reading || !links.trim()}
            className={button}
          >
            {reading ? 'Reading…' : 'Read pages'}
          </button>
          <p className="text-ink-muted text-[12.5px]">
            Big shops often refuse this; their pages need the button.
          </p>
        </div>
      </section>

      {notes.length ? (
        <ul role="status" className="text-danger space-y-1 text-[13px]">
          {notes.slice(0, 8).map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}
      {saved.length ? (
        <ul role="status" className="space-y-1 text-[13px]">
          {saved.slice(0, 5).map((s) => (
            <li key={`${s.id}-${s.name}`}>
              {s.updated ? 'Updated' : 'Saved'}{' '}
              <Link href={`/admin/catalog/${s.id}`} className="font-semibold underline">
                {s.name}
              </Link>
              {s.published ? ' · live' : ' · draft'}
              {s.note ? <span className="text-ink-muted"> · {s.note}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {current ? (
        <section aria-label="Check and save">
          <div className="mb-2 flex items-center gap-3">
            <h2 className="font-heading text-[17px] font-semibold">
              {queue.length === 1 ? 'Check and save' : `Check and save · 1 of ${queue.length}`}
            </h2>
            <button
              type="button"
              onClick={next}
              className="text-ink-muted ml-auto text-[13px] underline"
            >
              Skip {siteLabel(current.site)} product
            </button>
          </div>
          <ReviewForm
            key={current.url}
            product={current}
            data={data}
            onDone={(result) => {
              if ('id' in result) setSaved((s) => [result, ...s]);
              next();
            }}
          />
        </section>
      ) : (
        <p className="text-ink-muted text-[14px]">
          Nothing waiting. Products you send with the button appear here.
        </p>
      )}
    </div>
  );
}
