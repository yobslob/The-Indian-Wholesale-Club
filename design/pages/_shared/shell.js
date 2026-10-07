/*
 * The approved shell (D-079): builders for the header, banner, footer, hero and frames, and the behaviours (search pill,
 * Home scroll fade, frame fitting, mockup-bar toggles). A page builds its frames, then calls shellInit().
 */
const I = {
  bag: '<path d="M5 8h14l-1 13H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  burger: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4.5 4.5"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
};
const svg = (n) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`;
const logo = () => `<a class="logo" href="#"><span class="initial">I<svg viewBox="${INDIA_MARK.viewBox}" aria-hidden="true"><path d="${INDIA_MARK.path}" vector-effect="non-scaling-stroke"/></svg></span>ndian Wholesale Club</a>`;
const banner = () => `<div class="banner" role="note"><span class="long"><strong>Demo store.</strong> Nothing here is for sale and no real money is taken. To try checkout, pay with the test card 4242 4242 4242 4242, any future date and any CVC.</span><span class="short"><strong>Demo store.</strong> Nothing here is for sale. <details><summary>Test card</summary>4242 4242 4242 4242, any future date, any CVC.</details></span></div>`;

let uid = 0;
const header = ({ photo = false, active = '', searchOpen = false, panelOpen = false } = {}) => {
  const id = `nav-${++uid}`;
  return `
  <input type="checkbox" class="nav-toggle" id="${id}"${panelOpen ? ' checked' : ''} tabindex="-1" aria-hidden="true">
  <div class="top${photo ? ' over' : ''}">
    ${banner()}
    <header class="hdr ${photo ? 'photo' : 'solid'}">
      ${logo()}
      <nav class="links" aria-label="Main">
        <a href="#"${active === 'States' ? ' aria-current="page"' : ''}>States</a>
        <form class="srch${searchOpen ? ' is-open' : ''}" role="search" onsubmit="return false"><span class="sm" aria-hidden="true">Search</span>${svg('search')}<input type="search" placeholder="Search" aria-label="Search"></form>
        <a href="#"${active === 'About us' ? ' aria-current="page"' : ''}>About us</a>
      </nav>
      <div class="icons">
        <a class="ib" href="#" aria-label="Saved">${svg('heart')}</a>
        <a class="ib" href="#" aria-label="Bag, 3 pieces">${svg('bag')}<span class="count">3</span></a>
        <a class="ib" href="#" aria-label="Profile">${svg('person')}</a>
        <label class="ib burger" for="${id}" aria-label="Menu">${svg('burger')}</label>
      </div>
    </header>
  </div>
  <label class="scrim" for="${id}" aria-hidden="true"></label>
  <aside class="panel" aria-label="Menu">
    <label class="ib x" for="${id}" aria-label="Close">${svg('close')}</label>
    <div class="p-srch">${svg('search')}Search</div>
    <ul class="big"><li><a href="#">States</a></li><li><a href="#">About us</a></li></ul>
    <ul class="small"><li><a href="#">Track an order</a></li><li><a href="#">How it works</a></li><li><a href="#">Shipping &amp; returns</a></li><li><a href="#">FAQ</a></li><li><a href="#">Contact</a></li></ul>
  </aside>`;
};


const heroHtml = (opts, below = `${sample()}${footer()}`) => `${header({ photo: true, ...opts })}<div class="scroller"><div class="hero"><div class="name"><h1><span style="--i:0">Indian</span><span style="--i:1">Wholesale</span><span style="--i:2">Club</span></h1><p style="--i:3">Miss local market? <a href="#">Start here.</a></p></div></div>${below}</div>`;
const sample = () => `<div class="page-sample"><h1>Pick your home</h1><p>All 28 states and 8 union territories.</p><div class="ph-row"><div class="ph"></div><div class="ph"></div><div class="ph"></div><div class="ph"></div></div></div>`;
const footer = () => `<footer class="ftr">
  <div class="cols">
    <div><p class="name">The Indian Wholesale Club</p><p class="line">Clothing and spices from all of India, delivered in the US. </p></div>
    <div><h3>Shop</h3><ul><li><a href="#">States</a></li><li><a href="#">Search</a></li></ul></div>
    <div><h3>Help</h3><ul><li><a href="#">How it works</a></li><li><a href="#">Track an order</a></li><li><a href="#">Shipping &amp; returns</a></li><li><a href="#">FAQ</a></li><li><a href="#">Contact</a></li></ul></div>
    <div><h3>About</h3><ul><li><a href="#">About us</a></li><li><a href="#">Privacy</a></li><li><a href="#">Terms</a></li></ul></div>
  </div>
  <div class="base"><span>© The Indian Wholesale Club</span><span>Map data: <a href="#">DataMeet India</a>, CC BY 4.0</span></div>
  <div class="mini"><nav aria-label="Footer"><a href="#">Track an order</a><a href="#">Shipping &amp; returns</a><a href="#">FAQ</a><a href="#">Contact</a><a href="#">Privacy</a><a href="#">Terms</a></nav><p>© The Indian Wholesale Club · Map: <a href="#">DataMeet India</a>, CC BY 4.0</p></div>
</footer>`;

const label = { 1440: 'desktop', 1024: 'small laptop · tablet landscape', 768: 'tablet', 390: 'phone' };
const dev = (w, h, inner, cap) => `<div class="dev" data-w="${w}"><p class="cap">${cap || `${w} · ${label[w]}`}</p><div class="vp" style="width:${w}px;${h ? `height:${h}px` : ''}">${inner}</div></div>`;

const tabs = (active) => `<nav class="tabs">${[['home', 'Home'], ['search', 'Explore'], ['bag', 'Bag'], ['heart', 'Saved'], ['person', 'Profile']].map(([i, n]) => `<a href="#"${n === active ? ' aria-current="page"' : ''}>${svg(i)}${n}${n === 'Bag' ? '<span class="badge">3</span>' : ''}</a>`).join('')}</nav><span class="home-ind"></span>`;
const status = '<div class="status"><span>9:41</span><span>●●● ▮</span></div>';
const cap = (t) => `<p style="font:500 12px system-ui;color:#444;margin:0 0 6px">${t}</p>`;

// "Wholesale" width in em for the headline font: the hero sizes the name so this word fits the wall.
const setK = async () => {
  const f = '400 100px Cinzel';
  await document.fonts.load(f, 'Wholesale');
  const c = document.createElement('canvas').getContext('2d'); c.font = f;
  document.body.style.setProperty('--k', (c.measureText('Wholesale').width / 100).toFixed(3));
};
setK();

// Home scroll, as apps/web/features/home/hero-scroll.tsx: --hero-p is 0 at the top and 1 after 55 % of the hero;
// "passed" once the photo is under the header.
const initScrollers = () => document.querySelectorAll('.scroller').forEach((sc) => {
  const vp = sc.closest('.vp'), hero = sc.querySelector('.hero'), hdr = vp.querySelector('.hdr');
  const update = () => {
    vp.style.setProperty('--hero-p', Math.min(1, Math.max(0, sc.scrollTop / (hero.offsetHeight * .55))).toFixed(3));
    vp.classList.toggle('passed', sc.scrollTop >= hero.offsetHeight - hdr.offsetHeight - hdr.offsetTop);
  };
  sc.addEventListener('scroll', update, { passive: true }); update();
});


function shellInit() {
  initScrollers();
  // Search: mouse-out closes it again unless something was typed (the founder's round-2 rule).
  document.querySelectorAll('.srch').forEach((f) => f.addEventListener('mouseleave', () => {
    const i = f.querySelector('input'); if (!i.value) i.blur();
  }));

  // The word's own width at rest, in whichever font is on (re-measured when the fonts switch).
  const measure = () => document.querySelectorAll('.srch').forEach((f) => f.style.setProperty('--sw0', `${f.querySelector('.sm').offsetWidth + 4}px`));
  document.fonts.ready.then(measure);

  // Fit each frame to the available width (zoom keeps container queries on the frame's own width).
  const fit = () => document.querySelectorAll('.dev').forEach((d) => {
    const w = +d.dataset.w, vp = d.querySelector('.vp'), row = d.closest('.mk-row');
    const avail = row ? (row.clientWidth - 24 * (row.children.length - 1)) / row.children.length : d.parentElement.clientWidth;
    vp.style.zoom = Math.min(1, avail / w);
  });
  fit(); addEventListener('resize', fit);

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-set]'); if (!b) return;
    document.body.dataset[b.dataset.set] = b.dataset.val;
    document.querySelectorAll(`[data-set="${b.dataset.set}"]`).forEach((x) => x.setAttribute('aria-pressed', x.dataset.val === b.dataset.val));
  });

}
