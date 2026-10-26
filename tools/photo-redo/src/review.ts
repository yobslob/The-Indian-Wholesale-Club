import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';

import { PRODUCT_TYPES, type ProductType } from '@repo/shared/domain';

import { allWork, itemDir, writeDecision, type Work } from './items';
import { log } from './log';

/**
 * `review`: the new photos beside the old ones on this machine only (http://127.0.0.1:4317, nothing online). Each
 * photo: Approve or Reject (keys A and R act on the first one waiting); "Approve the rest that passed" approves every
 * photo still waiting whose automatic checks passed. `publish` then takes the approved ones.
 */
const PORT = 4317;

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function card(w: Work): string {
  const r = w.result!;
  const id = `${w.item.type}/${w.item.media_id}`;
  const checks = Object.entries(r.checks)
    .map(([k, v]) => `${esc(k)} ${esc(String(typeof v === 'number' ? Math.round(v * 1000) / 1000 : v))}`)
    .join(' · ');
  const state = w.item.published ? 'live' : w.decision ? (w.decision.ok ? 'approved' : 'rejected') : 'waiting';
  return `<figure class="card ${state}" data-id="${id}" data-pass="${r.pass}">
  <div class="pair"><img src="/img/${id}/before.png" loading="lazy" alt="before"><img src="/img/${id}/after.png" loading="lazy" alt="after"></div>
  <figcaption><b>${esc(w.item.name)}</b> <span class="tag">${state}</span> <span class="tag ${r.pass ? 'ok' : 'no'}">${r.pass ? 'checks passed' : 'check it'}</span>
  ${r.house_model ? `<span class="tag">${esc(r.house_model)}</span>` : ''}<br><small>${esc(r.note)} ${checks}</small><br>
  <button data-ok="1">Approve</button> <button data-ok="0">Reject</button></figcaption></figure>`;
}

function page(type: ProductType, works: Work[], all: boolean): string {
  const made = works.filter((w) => w.result?.status === 'made' && (all || (!w.decision && !w.item.published)));
  const count = (s: string) => works.filter((w) => w.result?.status === s).length;
  const tabs = PRODUCT_TYPES.map((t) => `<a href="/?type=${t}"${t === type ? ' class="on"' : ''}>${t}</a>`).join(' ');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Photo review</title><style>
body{font:14px system-ui;margin:16px;background:#faf7f2;color:#222}a{margin-right:12px}a.on{font-weight:700}
.card{display:inline-block;vertical-align:top;margin:8px;padding:8px;background:#fff;border:2px solid #ddd;width:min(560px,94vw)}
.pair{display:flex;gap:4px}.pair img{width:50%;height:auto;background:#eee}.approved{border-color:#2e7d32}.rejected{border-color:#c62828;opacity:.6}
.tag{font-size:12px;padding:1px 6px;border-radius:8px;background:#eee}.ok{background:#c8e6c9}.no{background:#ffcdd2}
button{margin-top:6px;padding:6px 14px}</style></head><body>
<p>${tabs} | ${made.length} shown · ${count('made')} made · ${count('none')} nothing to change · ${count('failed')} failed ·
<a href="/?type=${type}${all ? '' : '&all=1'}">${all ? 'only the waiting' : 'show all'}</a>
<button id="rest">Approve the rest that passed</button></p>
${made.map(card).join('\n') || '<p>Nothing waiting. Run the GPU step (tools/photo-worker/redo.py) or fetch more.</p>'}
<script>
async function decide(card, ok){await fetch('/decide',{method:'POST',body:JSON.stringify({id:card.dataset.id,ok})});
card.classList.remove('approved','rejected');card.classList.add(ok?'approved':'rejected');card.querySelector('.tag').textContent=ok?'approved':'rejected'}
document.addEventListener('click',e=>{const b=e.target.closest('button[data-ok]');if(b)decide(b.closest('.card'),b.dataset.ok==='1')});
document.getElementById('rest').onclick=async()=>{for(const c of document.querySelectorAll('.card:not(.approved):not(.rejected):not(.live)'))if(c.dataset.pass==='true')await decide(c,true)};
document.addEventListener('keydown',e=>{const c=document.querySelector('.card:not(.approved):not(.rejected):not(.live)');if(!c)return;
if(e.key==='a')decide(c,true);if(e.key==='r')decide(c,false);c.nextElementSibling?.scrollIntoView({block:'center'})});
</script></body></html>`;
}

export function review(out: string): Promise<void> {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
    const img = /^\/img\/(clothing|food|home)\/([0-9a-f-]{36})\/(before|after)\.png$/.exec(url.pathname);
    if (img) {
      const file = join(itemDir(out, { type: img[1] as ProductType, media_id: img[2]! }), `${img[3]}.png`);
      if (!existsSync(file)) return void res.writeHead(404).end();
      return void res.writeHead(200, { 'content-type': 'image/png' }).end(readFileSync(file));
    }
    if (url.pathname === '/decide' && req.method === 'POST') {
      let body = '';
      req.on('data', (c: Buffer) => (body += c));
      req.on('end', () => {
        const { id, ok } = JSON.parse(body) as { id: string; ok: boolean };
        const m = /^(clothing|food|home)\/([0-9a-f-]{36})$/.exec(id);
        if (!m) return void res.writeHead(400).end();
        writeDecision(itemDir(out, { type: m[1] as ProductType, media_id: m[2]! }), ok === true);
        res.writeHead(204).end();
      });
      return;
    }
    const type = PRODUCT_TYPES.find((t) => t === url.searchParams.get('type')) ?? 'clothing';
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(page(type, allWork(out, type), url.searchParams.has('all')));
  });
  return new Promise((resolve) => {
    server.listen(PORT, '127.0.0.1', () => log(`review: http://127.0.0.1:${PORT} (Ctrl+C to stop)`));
    server.on('close', resolve);
  });
}
