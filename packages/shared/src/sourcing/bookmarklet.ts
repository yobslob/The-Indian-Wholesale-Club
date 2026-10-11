/**
 * The "Add to IWC" bookmark (D-110). On a shop's product page, in the admin's own browser, it reads the product data
 * the page already shows (meta tags, schema.org JSON-LD, Myntra's pdpData, Amazon's title, price, photos and details)
 * and opens the importer in one reused tab with that data in the address hash (#iwc=<base64 JSON>). Nothing is sent
 * anywhere else, and nothing is saved until the admin reviews it. Reading in the admin's browser works where a server
 * is refused (Myntra, Amazon and Flipkart block data-centre requests).
 *
 * Plain ES5 inside a string, so it runs as a bookmark on any site; capture.ts caps every field it reads.
 */
const SOURCE = String.raw`(function(){
var O='__ORIGIN__';
function t(e){if(!e)return '';var s=e.innerText||e.textContent||'';return s.replace(/\s+/g,' ').trim();}
function q(s){return document.querySelector(s);}
function qa(s){return Array.prototype.slice.call(document.querySelectorAll(s));}
var c={v:1,url:location.href,canonical:(q('link[rel=canonical]')||{}).href||'',title:document.title.slice(0,900),meta:{},ld:[],dom:{}};
qa('meta').forEach(function(m){var k=m.getAttribute('property')||m.getAttribute('name')||m.getAttribute('itemprop');var v=m.getAttribute('content');
 if(k&&v&&/^(og:|product:|description$|price|pricecurrency)/i.test(k)){c.meta[k]=c.meta[k]||[];if(c.meta[k].length<20)c.meta[k].push(v.slice(0,1900));}});
qa('script[type="application/ld+json"]').forEach(function(s){var x=s.textContent||'';if(/product/i.test(x)&&c.ld.length<12)c.ld.push(x.slice(0,79000));});
try{var p=window.__myx&&window.__myx.pdpData;if(p){c.myntra={name:p.name,brand:p.brand&&{name:p.brand.name},mrp:p.mrp,price:p.price,media:p.media,
 productDetails:p.productDetails,articleAttributes:p.articleAttributes,analytics:p.analytics,
 sizes:(p.sizes||[]).map(function(s){return {label:s.label,available:s.available};})};}}catch(e){}
if(q('#productTitle')){
 var a={title:t(q('#productTitle')),byline:t(q('#bylineInfo')).slice(0,290),availability:t(q('#availability')).slice(0,490),
  price:t(q('#corePriceDisplay_desktop_feature_div .priceToPay .a-offscreen'))||t(q('#corePrice_feature_div .a-price .a-offscreen'))||t(q('.priceToPay .a-offscreen'))||t(q('#corePrice_desktop .a-price .a-offscreen'))||t(q('.a-price .a-offscreen')),
  mrp:t(q('#corePriceDisplay_desktop_feature_div .basisPrice .a-offscreen'))||t(q('.a-text-price .a-offscreen')),
  bullets:qa('#feature-bullets li').map(t).filter(Boolean).slice(0,20).map(function(b){return b.slice(0,1900);}),
  description:t(q('#productDescription')).slice(0,7900),size:t(q('#variation_size_name .selection')).slice(0,90),specs:[],images:[]};
 var imp=q('#important-information');if(imp)a.important=t(imp).slice(0,4900);
 qa('#productDetails_techSpec_section_1 tr,#productDetails_detailBullets_sections1 tr,#productOverview_feature_div tr,#technicalSpecifications_feature_div tr').forEach(function(r){
  var k=t(r.querySelector('th,td'));var cells=r.querySelectorAll('td');var v=t(cells[cells.length-1]);if(k&&v&&k!==v&&a.specs.length<80)a.specs.push([k.slice(0,190),v.slice(0,990)]);});
 qa('#detailBullets_feature_div li').forEach(function(li){var x=t(li).split(/\s*:\s*/);if(x.length>1&&a.specs.length<80)a.specs.push([x[0].slice(0,190),x.slice(1).join(': ').slice(0,990)]);});
 qa('script').forEach(function(s){var x=s.textContent||'';if(x.indexOf('colorImages')<0)return;var re=/"hiRes":"(https:[^"]+)"|"large":"(https:[^"]+)"/g,m;while((m=re.exec(x))&&a.images.length<80)a.images.push(m[1]||m[2]);});
 var li=q('#landingImage');if(li&&a.images.length<80)a.images.push(li.getAttribute('data-old-hires')||li.src);
 c.amazon=a;}
c.dom.images=qa('img').filter(function(i){return i.naturalWidth>=500&&i.naturalHeight>=500;}).map(function(i){return i.currentSrc||i.src;}).filter(function(u){return /^https:/.test(u)&&u.length<1900;}).slice(0,30);
c.dom.h1=t(q('h1')).slice(0,900);
var d=btoa(unescape(encodeURIComponent(JSON.stringify(c))));
var w=window.open(O+'/admin/import#iwc='+d,'iwc-import');
if(!w)alert('Allow pop-ups on this site to send products to IWC.');
})();`;

/** The bookmark's address for this site: drag it to the bookmarks bar. */
export function bookmarkletHref(origin: string): string {
  return `javascript:${encodeURIComponent(SOURCE.replace('__ORIGIN__', origin.replace(/[^a-zA-Z0-9:/.-]/g, '')))}`;
}

/** The bookmark's code, for tests. */
export const bookmarkletSource = (origin: string): string => SOURCE.replace('__ORIGIN__', origin);
