/*
 * Mockup runtime (C1): screen switcher + the motion layer proposed in D-049.
 * Motion is progressive enhancement: with prefers-reduced-motion (or the "Reduced motion"
 * preview toggle) nothing below runs, scrolling is native and every image is simply visible.
 * The real build ships this as one small client module loaded after the page is interactive.
 */
(function () {
  const root = document.documentElement;
  const screens = [...document.querySelectorAll('[data-screen]')];
  const links = [...document.querySelectorAll('.mock-switch a')];
  let lenis = null;

  // ---- Screen switcher (#home, #region, #product, #admin); other hashes are in-page anchors.
  function show(id, jump) {
    if (!screens.some((s) => s.id === id)) return false;
    screens.forEach((s) => (s.hidden = s.id !== id));
    links.forEach((a) => a.setAttribute('aria-current', a.hash === '#' + id ? 'page' : 'false'));
    if (jump) lenis ? lenis.scrollTo(0, { immediate: true }) : window.scrollTo(0, 0);
    if (lenis) lenis.resize();
    return true;
  }
  const initial = location.hash.slice(1);
  show(screens.some((s) => s.id === initial) ? initial : screens[0].id, false);
  window.addEventListener('hashchange', () => {
    const id = location.hash.slice(1);
    if (show(id, true)) return;
    const target = document.getElementById(id);
    if (target && lenis) lenis.scrollTo(target, { offset: -24 });
  });

  // ---- Reduced-motion preview toggle.
  let forced = false;
  try { forced = localStorage.getItem('iwc-mock-reduced') === '1'; } catch (e) {}
  const toggle = document.querySelector('[data-toggle-motion]');
  const reduce = forced || matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (toggle) {
    toggle.textContent = reduce ? 'Motion: off' : 'Motion: on';
    toggle.addEventListener('click', () => {
      try { localStorage.setItem('iwc-mock-reduced', forced ? '0' : '1'); } catch (e) {}
      location.reload();
    });
  }
  if (reduce) { root.classList.add('reduced'); return; }
  root.classList.add('motion');

  // ---- Reveal: gentle clip + scale + opacity as images enter the viewport.
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }),
    { rootMargin: '0px 0px -6% 0px' },
  );
  document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));

  // ---- Lenis smooth scroll (native scroll if the CDN script did not load).
  if (window.Lenis) lenis = new window.Lenis({ lerp: 0.085, wheelMultiplier: 1, smoothWheel: true });
  let velocity = 0;
  if (lenis) lenis.on('scroll', (l) => (velocity = l.velocity));

  // ---- Parallax (data-speed) and velocity drift (data-drift). Lighter on small screens.
  const para = [...document.querySelectorAll('[data-speed]')].map((el) => ({ el, y: 0, x: 0 }));
  const drift = [...document.querySelectorAll('[data-drift]')].map((el) => ({ el, x: 0 }));
  function frame(t) {
    if (lenis) lenis.raf(t); else velocity *= 0.9;
    const k = innerWidth < 700 ? 0.5 : 1;
    const mid = innerHeight / 2;
    for (const p of para) {
      if (p.el.offsetParent === null) continue;
      const r = p.el.getBoundingClientRect();
      const top = r.top - p.y; // position without our own transform
      if (top > innerHeight * 1.5 || top + r.height < -innerHeight * 0.5) continue;
      p.y = -(top + r.height / 2 - mid) * parseFloat(p.el.dataset.speed) * k;
      p.el.style.transform = `translate3d(0, ${p.y.toFixed(1)}px, 0)`;
    }
    for (const d of drift) {
      if (d.el.offsetParent === null) continue;
      const want = Math.max(-40, Math.min(40, velocity * parseFloat(d.el.dataset.drift) * k));
      d.x += (want - d.x) * 0.08;
      d.el.style.transform = `translate3d(${d.x.toFixed(1)}px, 0, 0)`;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
