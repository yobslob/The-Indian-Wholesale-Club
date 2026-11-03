import { MAX_CARRIED_LINES, MAX_QTY_PER_LINE } from '../features/cart/limits';

/**
 * E-1: the page a browser's first visit to an old vercel.app address gets (lib/legacy-move.ts). Its script reads the
 * bag that host's localStorage holds (the cart store's `iwc-cart`, cart/store.ts), puts its ids and quantities in the
 * fragment by the rules of cart/bag-fragment.ts (tests/legacy-move.test.ts runs this script against encodeBagFragment)
 * and replaces the page with the same address on the domain. Without script, a refresh and a link do the same with no
 * bag. Nothing else is read and nothing goes to a server: the fragment stays in the browser.
 */
export function bounceScript(location: string): string {
  const to = JSON.stringify(location).replace(/</g, '\\u003c');
  return (
    `(function(){var to=${to},f='';try{` +
    `var s=JSON.parse(localStorage.getItem('iwc-cart')||'null'),l=(s&&s.state&&s.state.lines)||[],p=[];` +
    `for(var i=0;i<l.length&&p.length<${MAX_CARRIED_LINES};i++){var x=l[i]||{},v=x.variantId,q=Math.floor(Number(x.quantity));` +
    `if(typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)&&q>0)` +
    `p.push(v.toLowerCase()+':'+Math.min(q,${MAX_QTY_PER_LINE}));}` +
    `if(p.length)f='#bag='+btoa(p.join(',')).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');` +
    `}catch(e){}if(!f&&location.hash)f=location.hash;location.replace(to+f);})();`
  );
}

const attr = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function bounceHtml(location: string): string {
  const href = attr(location);
  const host = attr(new URL(location).host);
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1"><title>The Indian Wholesale Club</title>` +
    `<link rel="canonical" href="${href}"><noscript><meta http-equiv="refresh" content="0;url=${href}"></noscript>` +
    `<script>${bounceScript(location)}</script></head>` +
    `<body><p><a href="${href}">Continue to ${host}</a></p></body></html>`
  );
}
