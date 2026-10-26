import { INDIA_MARK } from '@repo/shared/india-map/mark';

/**
 * The gold outline of India (D-077) as a small icon: the IWC store tab's mark. A server component handed to the tab as a
 * prop, so the outline's path rides in the page, not in every page's JavaScript.
 */
export function IndiaMark(): React.JSX.Element {
  return (
    <svg viewBox={INDIA_MARK.viewBox} focusable="false" aria-hidden="true">
      <path d={INDIA_MARK.path} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * The same outline once per page as a symbol (D-161), for client parts that draw it with `<use href="#india-mark">`
 * (the free-delivery pill's flight path), so the path rides in the HTML once and never in their JavaScript.
 */
export function IndiaSymbol(): React.JSX.Element {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" className="absolute">
      <symbol id="india-mark" viewBox={INDIA_MARK.viewBox}>
        <path d={INDIA_MARK.path} vectorEffect="non-scaling-stroke" />
      </symbol>
    </svg>
  );
}
