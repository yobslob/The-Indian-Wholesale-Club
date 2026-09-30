'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

/** How long the pointer rests on a name or stamp before its state lights up on the map (D-051). */
export const NAME_HOVER_MS = 700;

interface RegionRef {
  slug: string;
  name: string;
  live: boolean;
}

/**
 * The interactive layer of "Pick your home" (server-rendered markup as children, listeners attached by
 * delegation). Hovering the map lights a state at once and shows its name; resting on a name or stamp for
 * 700 ms lights its state; keyboard focus lights it at once. Search filters the names and stamps and fades
 * the rest of the map. Clicking an open state opens its page.
 */
export function PickHomeInteractive({
  className,
  regions,
  children,
}: {
  className: string;
  regions: RegionRef[];
  children: React.ReactNode;
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const bySlug = new Map(regions.map((r) => [r.slug, r]));
    const svg = root.querySelector<SVGSVGElement>('[data-map]');
    const panel = root.querySelector<HTMLElement>('[data-map-panel]');
    const tip = root.querySelector<HTMLElement>('[data-map-tip]');
    if (!svg || !panel || !tip) return;

    let current: string | null = null;
    let pending: string | null = null;
    let timer = 0;
    const onMap = (el: Element): boolean => svg.contains(el);
    const slugOf = (target: EventTarget | null): { slug: string; el: Element } | null => {
      const el = target instanceof Element ? target.closest('[data-slug]') : null;
      return el && root.contains(el) ? { slug: el.getAttribute('data-slug') ?? '', el } : null;
    };

    const highlight = (slug: string | null): void => {
      if (current) root.querySelectorAll(`[data-slug="${current}"]`).forEach((el) => el.removeAttribute('data-on'));
      current = slug;
      if (slug) root.querySelectorAll(`[data-slug="${slug}"]`).forEach((el) => el.setAttribute('data-on', ''));
    };
    const showTip = (slug: string, x: number, y: number): void => {
      const r = bySlug.get(slug);
      if (!r) return;
      tip.replaceChildren(r.name, Object.assign(document.createElement('small'), {
        textContent: r.live ? 'Open now · click to enter' : 'Coming soon',
      }));
      tip.style.left = `${x}px`;
      tip.style.top = `${y}px`;
      tip.hidden = false;
    };
    const tipAtShape = (slug: string): void => {
      const shape = svg.querySelector(`[data-slug="${slug}"]`)?.getBoundingClientRect();
      const box = panel.getBoundingClientRect();
      if (shape) showTip(slug, shape.left + shape.width / 2 - box.left, shape.top + shape.height / 2 - box.top);
    };
    const clear = (): void => {
      window.clearTimeout(timer);
      pending = null;
      highlight(null);
      tip.hidden = true;
    };

    const onPointerMove = (e: PointerEvent): void => {
      const hit = slugOf(e.target);
      if (!hit || !onMap(hit.el)) return;
      highlight(hit.slug);
      const box = panel.getBoundingClientRect();
      showTip(hit.slug, e.clientX - box.left, e.clientY - box.top);
    };
    const onPointerOver = (e: PointerEvent): void => {
      const hit = slugOf(e.target);
      // Moving between the parts of one stamp must not restart its timer.
      if (!hit || onMap(hit.el) || hit.slug === pending || hit.slug === current) return;
      window.clearTimeout(timer);
      pending = hit.slug;
      timer = window.setTimeout(() => {
        pending = null;
        highlight(hit.slug);
        tipAtShape(hit.slug);
      }, NAME_HOVER_MS);
    };
    const onPointerOut = (e: PointerEvent): void => {
      const from = slugOf(e.target);
      const to = slugOf(e.relatedTarget);
      if (from && (!to || to.slug !== from.slug)) clear();
    };
    const onFocusIn = (e: FocusEvent): void => {
      const hit = slugOf(e.target);
      if (!hit) return;
      highlight(hit.slug);
      tipAtShape(hit.slug);
    };
    const onClick = (e: MouseEvent): void => {
      const hit = slugOf(e.target);
      if (hit && onMap(hit.el) && bySlug.get(hit.slug)?.live) router.push(`/states/${hit.slug}`);
    };
    const onInput = (e: Event): void => {
      if (!(e.target instanceof HTMLInputElement) || !e.target.hasAttribute('data-search')) return;
      const q = e.target.value.trim().toLowerCase();
      let shown = 0;
      root.querySelectorAll<HTMLElement>('[data-name]').forEach((el) => {
        const hit = !q || (el.getAttribute('data-name') ?? '').toLowerCase().includes(q);
        el.hidden = !hit;
        if (hit) shown += 1;
      });
      svg.toggleAttribute('data-searching', q.length > 0);
      svg.querySelectorAll('[data-slug]').forEach((el) => {
        const name = bySlug.get(el.getAttribute('data-slug') ?? '')?.name.toLowerCase() ?? '';
        el.toggleAttribute('data-match', q.length > 0 && name.includes(q));
      });
      const empty = root.querySelector<HTMLElement>('[data-empty]');
      if (empty) empty.hidden = shown > 0;
    };

    svg.addEventListener('pointermove', onPointerMove);
    svg.addEventListener('pointerleave', clear);
    svg.addEventListener('click', onClick);
    root.addEventListener('pointerover', onPointerOver);
    root.addEventListener('pointerout', onPointerOut);
    root.addEventListener('focusin', onFocusIn);
    root.addEventListener('focusout', clear);
    root.addEventListener('input', onInput);
    return () => {
      window.clearTimeout(timer);
      svg.removeEventListener('pointermove', onPointerMove);
      svg.removeEventListener('pointerleave', clear);
      svg.removeEventListener('click', onClick);
      root.removeEventListener('pointerover', onPointerOver);
      root.removeEventListener('pointerout', onPointerOut);
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('focusout', clear);
      root.removeEventListener('input', onInput);
    };
  }, [regions, router]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
