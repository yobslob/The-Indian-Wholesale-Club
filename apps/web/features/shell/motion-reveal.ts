/**
 * The reveal, the parallax and the album pause (D-049, D-052) for one page: images still below the fold are hidden
 * and reveal as they enter, [data-speed] elements float a little with the scroll, and a Diwali window
 * ([data-album]) animates only while on screen. Only what is below the fold is ever hidden, so nothing on screen
 * flickers, and without JavaScript everything is visible. Nothing here runs with reduced motion (motion.tsx).
 *
 * Parts a page draws later (Home's rows and map as they come near, launch QA C-2) join through `enhanceMotion`
 * once they are in the DOM: anything of theirs not yet past the reveal line starts hidden and reveals as it enters,
 * like the rest of the page.
 */
export interface PageMotion {
  add: (root: ParentNode, fresh: boolean) => void;
  stop: () => void;
}

let current: PageMotion | null = null;

/** A part drawn after the page opened (Home's lazily drawn sections): reveal, parallax and pause for it too. */
export function enhanceMotion(root: Element): void {
  current?.add(root, true);
}

export function startPageMotion(): PageMotion {
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.setAttribute('data-reveal', 'in');
        io.unobserve(e.target);
      }),
    { rootMargin: '0px 0px -6% 0px' },
  );
  const albums = new IntersectionObserver((entries) =>
    entries.forEach((e) => e.target.setAttribute('data-album', e.isIntersecting ? 'on' : 'off')),
  );

  const moving: HTMLElement[] = [];
  const factor = window.innerWidth < 820 ? 0.5 : 1;
  let frame = 0;
  let listening = false;
  const place = (): void => {
    frame = 0;
    for (const el of moving) {
      const rect = el.parentElement?.getBoundingClientRect();
      if (!rect || rect.bottom < 0 || rect.top > window.innerHeight) continue;
      const offset = (rect.top + rect.height / 2 - window.innerHeight / 2) * Number(el.dataset.speed) * factor;
      el.style.transform = `translate3d(0, ${(-offset).toFixed(1)}px, 0)`;
    }
  };
  const schedule = (): void => {
    if (!frame) frame = requestAnimationFrame(place);
  };

  const add = (root: ParentNode, fresh: boolean): void => {
    // On load: at the fold = not yet seen (Home's album). A part drawn later: anything not yet past the reveal line.
    const line = window.innerHeight * (fresh ? 0.94 : 1);
    const pending = [...root.querySelectorAll<HTMLElement>('[data-reveal]')].filter(
      (el) => el.getAttribute('data-reveal') === '' && el.getBoundingClientRect().top >= line,
    );
    pending.forEach((el) => {
      el.setAttribute('data-reveal', 'pending');
      io.observe(el);
    });

    const more = [...root.querySelectorAll<HTMLElement>('[data-speed]')].filter((el) => !moving.includes(el));
    if (more.length > 0) {
      moving.push(...more);
      place();
      if (!listening) {
        window.addEventListener('scroll', schedule, { passive: true });
        listening = true;
      }
    }
    root.querySelectorAll('[data-album]').forEach((el) => albums.observe(el));
  };

  const page: PageMotion = {
    add,
    stop: () => {
      if (current === page) current = null;
      io.disconnect();
      albums.disconnect();
      window.removeEventListener('scroll', schedule);
      cancelAnimationFrame(frame);
    },
  };
  current = page;
  add(document, false);
  return page;
}
