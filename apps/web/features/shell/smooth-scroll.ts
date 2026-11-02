/**
 * Lenis smooth scrolling (D-049) for a mouse or trackpad only, and only while something moves (launch QA C-1):
 * - phones and tablets (`pointer: coarse`) and reduced motion keep the browser's own scrolling: Lenis there replaced
 *   the phone's momentum and ran a frame loop for the life of the page;
 * - the frame loop runs while Lenis animates a scroll and stops a few frames after it settles; a wheel, a touch on a
 *   trackpad or any scrollTo (anchors included) starts it again;
 * - the scroll's velocity (`--sv`, D-116) is written only while it changes, on the `.drift` grids and rows that read it
 *   (globals.css), never on <html>: a write there restyled the whole page every frame.
 * Lenis is imported after the page is interactive (not in the first-load bundle, engineering.md §Budgets).
 */
export function wantsSmoothScroll(): boolean {
  return (
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches && !window.matchMedia('(pointer: coarse)').matches
  );
}

/** Writes the velocity on every drift container on the page (lazily drawn rows included); 0 removes it. */
function writeVelocity(v: number): void {
  document.querySelectorAll<HTMLElement>('.drift').forEach((el) => {
    if (v === 0) el.style.removeProperty('--sv');
    else el.style.setProperty('--sv', v.toFixed(1));
  });
}

/** Starts Lenis; returns the function that stops it. */
export function startSmoothScroll(): () => void {
  let stop = (): void => {};
  let cancelled = false;
  void import('lenis').then(({ default: Lenis }) => {
    if (cancelled) return;
    // anchors: jump links scroll smoothly; Lenis subtracts html's scroll-padding-top (below the sticky header,
    // globals.css) and the target's scroll-margin itself, so no extra offset here.
    const lenis = new Lenis({ lerp: 0.09, anchors: true });

    let frame = 0;
    let still = 0;
    const loop = (t: number): void => {
      lenis.raf(t);
      still = lenis.isScrolling === 'smooth' ? 0 : still + 1;
      frame = still > 3 ? 0 : requestAnimationFrame(loop);
    };
    const wake = (): void => {
      if (frame) return;
      still = 0;
      // Lenis measures each step from the last frame it saw: after a rest that gap would make the first step a jump
      lenis.time = 0;
      frame = requestAnimationFrame(loop);
    };
    lenis.on('virtual-scroll', wake);
    // every programmatic scroll goes through scrollTo, Lenis's own anchor clicks too (they call this.scrollTo)
    const scrollTo = lenis.scrollTo.bind(lenis);
    lenis.scrollTo = (...args: Parameters<typeof scrollTo>): void => {
      wake();
      scrollTo(...args);
    };

    // Lenis eases its velocity back to 0 as the page settles, so the drift springs home by itself. Written only when
    // it moves by more than 0.1 px, which also lets it rest at exactly 0.
    let last = 0;
    lenis.on('scroll', ({ velocity }) => {
      const v = Math.max(-30, Math.min(30, Math.abs(velocity) < 0.1 ? 0 : velocity));
      if (Math.abs(v - last) < 0.1 && (v !== 0 || last === 0)) return;
      last = v;
      writeVelocity(v);
    });

    stop = () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
      writeVelocity(0);
    };
  });
  return () => {
    cancelled = true;
    stop();
  };
}
