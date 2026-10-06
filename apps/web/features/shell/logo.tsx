import { INDIA_MARK } from '@repo/shared/india-map/mark';

import styles from './logo.module.css';

/**
 * The logo text (D-077): "Indian Wholesale Club" with its I standing inside a gold outline of India, the outline cut
 * open on the east where the rest of the word runs. Text, not an image: it keeps the header's font and colour, and the
 * Home hero's scroll fade (globals.css) applies to it whole.
 */
export function LogoText(): React.JSX.Element {
  return (
    <>
      <span className={styles.initial}>
        I
        <svg className={styles.india} viewBox={INDIA_MARK.viewBox} aria-hidden="true" focusable="false">
          <path d={INDIA_MARK.path} vectorEffect="non-scaling-stroke" />
        </svg>
      </span>
      ndian Wholesale Club
    </>
  );
}
