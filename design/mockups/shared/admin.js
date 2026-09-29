/*
 * Admin Listing mockup (C1), shared by all three directions: only the tokens change
 * (design.md §Admin look). Fields follow the real form (apps/web/app/admin/(panel)/listings)
 * and flows.md §2; items tagged "target" are coding-phase features (C3, C6), not built yet.
 */
(function () {
  const root = document.getElementById('admin-root');
  if (!root) return;
  const ph = (cls) => `<div class="ph ${cls}" style="--ar:4/5;border-radius:6px" aria-hidden="true"></div>`;
  const target = '<span class="adm-target">target</span>';

  const phone = `
  <div>
    <h2>Phone · add a listing</h2>
    <p class="adm-note">What the COO sees in the field. 390 px wide, every tap target at least 44 px.</p>
    <div class="adm-phone">
      <div class="adm-bar"><strong>Listings</strong><span>≡</span></div>
      <div class="adm-tabs"><span class="on">New</span><span>Drafts 2</span><span>Live</span><span>Paused</span></div>
      <form class="adm-form" onsubmit="return false">
        <label class="adm-field"><span>Shop</span>
          <select class="adm-input"><option>Demo shop (Kerala) · Kerala</option></select></label>
        <div class="adm-field"><span>Photos (first one is the cover) ${target}</span>
          <div class="adm-photos">${ph('ph--kasavu')}${ph('ph--portrait')}${ph('ph--mundu')}<div class="adm-cam">＋<br>Camera</div></div>
        </div>
        <div class="adm-field"><span>Type</span>
          <div class="adm-seg"><span class="on">Clothing</span><span>Spice<br><small>can’t go live yet (D-032)</small></span></div></div>
        <label class="adm-field"><span>Category</span>
          <select class="adm-input"><option>Sarees</option></select></label>
        <label class="adm-field"><span>Name</span><input class="adm-input" value="Kasavu saree"></label>
        <label class="adm-field"><span>Summary</span><input class="adm-input" placeholder="One line for the product card"></label>
        <div class="adm-row">
          <label class="adm-field"><span>Fabric</span><input class="adm-input" placeholder="e.g. 100% cotton"></label>
          <label class="adm-field"><span>Care</span><input class="adm-input"></label>
        </div>
        <div class="adm-field"><span>Variants and pieces at the shop</span>
          <div class="adm-var"><input class="adm-input" value="Free size"><div class="adm-step"><b>−</b><output>3</output><b>＋</b></div></div>
          <div class="adm-btn">＋ Add a variant</div>
        </div>
        <div class="adm-row">
          <label class="adm-field"><span>Shop price (₹)</span><input class="adm-input" inputmode="decimal" value="2,500"></label>
          <label class="adm-field"><span>Price (USD)</span><input class="adm-input" inputmode="decimal" value="99.00"></label>
        </div>
        <div class="adm-suggest">Suggested price ${target}<br><span style="color:var(--muted)">Shows once every pricing setting is set (C6, estimates labelled as estimates).</span></div>
      </form>
      <div class="adm-save"><div class="adm-btn">Save draft</div><div class="adm-btn primary">Send for review</div></div>
    </div>
  </div>`;

  const rows = [
    ['ph--kasavu', 'Kasavu saree', 'Kerala', 'Demo shop (Kerala)', '$99.00', 3, 'draft'],
    ['ph--bandhani', 'Bandhani dupatta', 'Rajasthan', 'Demo shop (Rajasthan)', '$49.00', 4, 'draft'],
  ];
  const stale = [
    ['ph--mundu', 'Mundu', 'Demo shop (Kerala)', 'Free size', 5, '12 days ago'],
    ['ph--phulkari', 'Phulkari dupatta', 'Demo shop (Punjab)', 'Orange', 2, '9 days ago'],
  ];

  const desk = `
  <div>
    <h2>Desk · review drafts</h2>
    <p class="adm-note">Same screen on a laptop: dense tables, one job per section. All rows are dev placeholders.</p>
    <div class="adm-scroll"><table class="adm-table">
      <thead><tr><th></th><th>Product</th><th>Region</th><th>Shop</th><th class="num">Price</th><th class="num">Pieces</th><th></th></tr></thead>
      <tbody>${rows
        .map(
          (r) => `<tr><td class="adm-thumb">${ph(r[0])}</td><td><u>${r[1]}</u></td><td>${r[2]}</td><td>${r[3]}</td>
          <td class="num">${r[4]}</td><td class="num">${r[5]}</td><td><span class="adm-pill">Publish</span></td></tr>`,
        )
        .join('')}</tbody>
    </table></div>
    <h2 style="margin-top:28px">Quantities to re-check with the shop ${target}</h2>
    <div class="adm-scroll"><table class="adm-table">
      <thead><tr><th></th><th>Product</th><th>Shop</th><th>Variant</th><th class="num">Pieces</th><th>Confirmed</th><th></th></tr></thead>
      <tbody>${stale
        .map(
          (r) => `<tr><td class="adm-thumb">${ph(r[0])}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td>
          <td class="num">${r[4]}</td><td><span class="adm-pill warn">${r[5]}</span></td><td><span class="adm-pill">Confirm</span></td></tr>`,
        )
        .join('')}</tbody>
    </table></div>
  </div>`;

  root.innerHTML = `<div class="adm">${phone}${desk}</div>`;
})();
