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
