import { PRODUCT_TYPES, type ProductType } from '@repo/shared/domain';

import { wordsOf, type Work } from './items';

/** The review page's HTML (review.ts serves it): one card per listing, the shop's words left, the new ones right. */

export type View = 'waiting' | 'flagged' | 'approved' | 'rejected' | 'live';

const esc = (s: string): string =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

function card(w: Work): string {
  const r = w.result;
  const words = wordsOf(w);
  const state = w.item.published
    ? `live (${w.item.published.redo})`
    : w.decision
      ? w.decision.words
        ? 'edited'
        : w.decision.ok
          ? 'approved'
          : 'rejected'
      : (r?.status ?? 'to write');
  const failures = r?.failures.length
    ? `<div class="no">${r.failures.map(esc).join('<br>')}</div>`
    : '';
  const facts = r
    ? `${Math.round(r.overlap * 100)} % shared · ${r.run} words in a row at most · ${r.tries} tries · ${r.seconds.toFixed(0)} s`
    : '';
  return `<article class="card ${state.split(' ')[0]}" data-id="${w.item.product_id}" data-type="${w.item.type}">
  <header><b>${esc(w.item.name)}</b> <span class="tag">${esc(w.item.category)}</span> <span class="tag state">${esc(state)}</span>${w.item.trial ? ' <span class="tag">trial</span>' : ''}</header>
  <div class="pair">
    <div><h4>Now</h4><p class="sum">${esc(w.item.summary ?? '')}</p><pre>${esc(w.item.description ?? '')}</pre></div>
    <div><h4>New</h4><textarea class="s" rows="2" readonly>${esc(words?.summary ?? '')}</textarea>
      <textarea class="d" rows="12" readonly>${esc(words?.description ?? '')}</textarea></div>
  </div>
  <footer>${failures}<small>${facts}</small><br>
    <button data-ok="1">Approve</button> <button data-ok="0">Reject</button> <button class="edit">Edit</button>
    <button class="save" hidden>Save my words</button> <span class="msg"></span></footer></article>`;
}

export function page(p: {
  type: ProductType | null;
  view: View;
  counts: Record<View, number>;
  works: Work[];
  page: number;
  pages: number;
}): string {
  const q = (o: Partial<{ type: string | null; view: string; page: number }>): string => {
    const s = new URLSearchParams();
    const type = o.type === undefined ? p.type : o.type;
    if (type) s.set('type', type);
    s.set('view', o.view ?? p.view);
    if (o.page) s.set('page', String(o.page));
    return `/?${s}`;
  };
  const types = [null, ...PRODUCT_TYPES]
    .map(
      (t) =>
        `<a href="${q({ type: t, page: 0 })}"${t === p.type ? ' class="on"' : ''}>${t ?? 'all'}</a>`,
    )
    .join(' ');
  const views = (Object.keys(p.counts) as View[])
    .map(
      (v) =>
        `<a href="${q({ view: v, page: 0 })}"${v === p.view ? ' class="on"' : ''}>${v} (${p.counts[v]})</a>`,
    )
    .join(' ');
  const pager =
    p.pages > 1
      ? `${p.page > 0 ? `<a href="${q({ page: p.page - 1 })}">‹ back</a>` : ''} page ${p.page + 1} of ${p.pages} ${
          p.page + 1 < p.pages ? `<a href="${q({ page: p.page + 1 })}">next ›</a>` : ''
        }`
      : '';
  return `<!doctype html><html><head><meta charset="utf-8"><title>Description review</title><style>
body{font:14px system-ui;margin:16px;background:#faf7f2;color:#222}a{margin-right:10px}a.on{font-weight:700}
.card{margin:10px 0;padding:10px;background:#fff;border:2px solid #ddd;max-width:1200px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:800px){.pair{grid-template-columns:1fr}}pre{white-space:pre-wrap;font:13px system-ui;margin:0;color:#555}
.sum{color:#555;font-style:italic;margin:0 0 6px}textarea{width:100%;box-sizing:border-box;font:13px system-ui;border:1px solid #eee}
textarea:not([readonly]){border-color:#2e7d32;background:#f6fff6}h4{margin:4px 0}.tag{font-size:12px;padding:1px 6px;border-radius:8px;background:#eee}
.approved,.edited{border-color:#2e7d32}.rejected{border-color:#c62828;opacity:.7}.flagged,.failed{border-color:#ef6c00}.live{opacity:.7}
.no{color:#c62828;font-size:13px;margin:4px 0}button{margin-top:6px;padding:6px 14px}</style></head><body>
<p>${types}</p><p>${views} <button id="all">Approve all ${p.counts.waiting} that passed</button></p>
<p><small>A approves and R rejects the first card not yet decided. Rejected ones are written again by the next make.
Then: pnpm descriptions:redo publish</small></p>
${p.works.map(card).join('\n') || '<p>Nothing here. Fetch and make more, or pick another view.</p>'}
<p>${pager}</p>
<script>
async function send(card,data){const r=await fetch('/decide',{method:'POST',body:JSON.stringify({id:card.dataset.id,type:card.dataset.type,...data})});return [r.status,await r.json()]}
function mark(card,s){card.classList.remove('approved','rejected','edited','made','flagged','failed');card.classList.add(s);card.querySelector('.state').textContent=s}
async function decide(card,ok){await send(card,{ok});mark(card,ok?'approved':'rejected')}
document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;const card=b.closest('.card');if(!card)return;
if(b.dataset.ok)return decide(card,b.dataset.ok==='1');
if(b.classList.contains('edit')){card.querySelectorAll('textarea').forEach(t=>t.readOnly=false);card.querySelector('.save').hidden=false;return}
if(b.classList.contains('save')){const [st,j]=await send(card,{summary:card.querySelector('.s').value,description:card.querySelector('.d').value});
card.querySelector('.msg').textContent=st===422?'Not saved: '+j.failures.join('; '):j.failures.length?'Saved, but check: '+j.failures.join('; '):'Saved';
if(st===200){mark(card,'edited');card.querySelectorAll('textarea').forEach(t=>t.readOnly=true);b.hidden=true}}});
document.getElementById('all').onclick=async()=>{if(!confirm('Approve every listing here that passed the checks and is still waiting?'))return;
const r=await fetch('/approve-all${p.type ? `?type=${p.type}` : ''}',{method:'POST'});alert((await r.json()).approved+' approved. Next: pnpm descriptions:redo publish');location.reload()};
document.addEventListener('keydown',e=>{if(e.target.tagName==='TEXTAREA'&&!e.target.readOnly)return;
const c=[...document.querySelectorAll('.card')].find(x=>!/approved|rejected|edited|live/.test(x.className));if(!c)return;
if(e.key==='a')decide(c,true);if(e.key==='r')decide(c,false);c.nextElementSibling?.scrollIntoView({block:'center'})});
</script></body></html>`;
}
