/* Shared page parts settled in home (D-080): the product card with the + on its photo, and the row arrows. */
const plus = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';

const card = ([name, price, state, img, sizes]) => `<li class="card">
  <div class="box"><a class="img" href="#"${img ? ` style="background-image:url(${img})"` : ''}>${img ? '' : '<span class="ph-tag">placeholder</span>'}</a>
  <a class="add" href="#" aria-label="${sizes ? `Choose options for ${name}` : `Add ${name} to bag`}">${plus}</a></div>
  <div class="txt"><p class="name">${name}</p><p class="meta">${price} · ${state}</p></div></li>`;

function initRows() {
  // Row arrows, as row-scroller.tsx: 85 % of the row per click, each hidden at its end.
  document.querySelectorAll('.rowwrap').forEach((w) => {
    const row = w.querySelector('.row'), [prev, next] = w.querySelectorAll('.rarr');
    const sync = () => { prev.disabled = row.scrollLeft <= 4; next.disabled = row.scrollLeft + row.clientWidth >= row.scrollWidth - 4; };
    prev.addEventListener('click', () => row.scrollBy({ left: -row.clientWidth * .85, behavior: 'smooth' }));
    next.addEventListener('click', () => row.scrollBy({ left: row.clientWidth * .85, behavior: 'smooth' }));
    row.addEventListener('scroll', sync, { passive: true }); sync();
  });
}

/* Open-state stamps (D-080): up to 6 sit as a grid; from 7, pages of 6 with an arrow each side and a count. */
const POSTMARK = 'ARRIVES OCT 30 – NOV 4 · '; // sample dates: the build takes them from cycle data (D-008)
const STAMP_PHOTO = { kerala: '../../mockups/assets/kerala.jpg', punjab: '../../mockups/assets/punjab_1.jpg', rajasthan: '../../mockups/assets/rajasthan.jpg' };
const postmark = (id) => `<svg class="postmark" viewBox="0 0 100 100" aria-hidden="true"><defs><path id="${id}" d="M50 50 m-35 0 a35 35 0 1 1 70 0 a35 35 0 1 1 -70 0"/></defs><circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="50" cy="50" r="25" fill="none" stroke="currentColor" stroke-width="1"/><text class="ring"><textPath href="#${id}">${POSTMARK.repeat(2)}</textPath></text><text class="mid" x="50" y="54" text-anchor="middle">IWC</text></svg>`;
let stampUid = 0;
function stampsBlock(live) {
  const k = ++stampUid;
  const stamp = (r, i) => `<a class="stamp" href="#" data-slug="${r.slug}" data-name="${r.name.toLowerCase()}"><span class="face${STAMP_PHOTO[r.slug] ? '' : ' ph'}"${STAMP_PHOTO[r.slug] ? ` style="background-image:url(${STAMP_PHOTO[r.slug]})"` : ''}></span><span class="caption"><em>${r.name}</em><b>Open</b></span>${postmark(`pm${k}-${i}`)}</a>`;
  const pages = []; for (let i = 0; i < live.length; i += 6) pages.push(live.slice(i, i + 6));
  const stampsHtml = live.length <= 6
    ? `<div class="stamps">${live.map(stamp).join('')}</div>`
    : `<div class="spager"><div class="spages">${pages.map((pg, p) => `<div class="stamps">${pg.map((r, i) => stamp(r, p * 6 + i)).join('')}</div>`).join('')}</div><button class="sarr l" type="button" aria-label="Previous states" disabled>←</button><button class="sarr r" type="button" aria-label="More states">→</button><span class="spcount">1 / ${pages.length}</span></div>`;
  return stampsHtml;
}
function initStampPagers() {
  // Stamp pages: one page per click, smooth; each arrow hides at its end; the counter follows.
  document.querySelectorAll('.spager').forEach((w) => {
    const track = w.querySelector('.spages'), [prev, next] = w.querySelectorAll('.sarr'), count = w.querySelector(".spcount");
    const n = track.children.length;
    const sync = () => {
      const i = Math.round(track.scrollLeft / track.clientWidth);
      prev.disabled = i <= 0; next.disabled = i >= n - 1; count.textContent = `${i + 1} / ${n}`;
    };
    prev.addEventListener('click', () => track.scrollBy({ left: -track.clientWidth, behavior: 'smooth' }));
    next.addEventListener('click', () => track.scrollBy({ left: track.clientWidth, behavior: 'smooth' }));
    track.addEventListener('scroll', sync, { passive: true }); sync();
  });
}
