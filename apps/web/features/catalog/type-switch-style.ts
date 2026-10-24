/** The frosted-glass segmented control (D-122), shared by See all's links and Home's Just listed switch (D-136). */
export const typeSwitch =
  'border-line/70 bg-paper/55 inline-flex max-w-full gap-1 overflow-x-auto rounded-pill border p-1 shadow-[0_6px_24px_rgba(20,17,15,0.08)] backdrop-blur-xl backdrop-saturate-150';
export const typeSwitchItem = (on: boolean): string =>
  `font-ui inline-flex min-h-10 shrink-0 items-center rounded-pill px-5 text-sm font-medium transition-colors duration-300 ${
    on ? 'bg-ink text-paper' : 'text-ink hover:bg-ink/5'
  }`;
