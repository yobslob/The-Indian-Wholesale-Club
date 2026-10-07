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
