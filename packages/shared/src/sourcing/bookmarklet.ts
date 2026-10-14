/**
 * The "Add to IWC" bookmark (D-110). On a shop's product page, in the admin's own browser, it reads the product data
 * the page already shows (meta tags, schema.org JSON-LD, Myntra's pdpData, Amazon's title, price, photos, details
 * and variation picker, Flipkart's option links, Shopify's product data, the delivery promise) and opens the importer
 * in one reused tab with that data in the address hash (#iwc=<base64 JSON>). Nothing is sent anywhere else, and
 * nothing is saved until the admin reviews it. Reading in the admin's browser works where a server is refused
 * (Myntra, Amazon and Flipkart block data-centre requests). The sourcing runner (D-118) runs the same capture in its
 * own browser (`captureScript`).
 *
 * Plain ES5 inside a string, so it runs as a bookmark on any site; capture.ts caps every field it reads.
 */
const CAPTURE = String.raw`(function(){
function t(e){if(!e)return '';var s=e.innerText||e.textContent||'';return s.replace(/\s+/g,' ').trim();}
function q(s){return document.querySelector(s);}
function qa(s){return Array.prototype.slice.call(document.querySelectorAll(s));}
function js(x,re){var m=x.match(re);if(!m)return undefined;try{return JSON.parse(m[1]);}catch(e){return undefined;}}
var c={v:1,url:location.href,canonical:(q('link[rel=canonical]')||{}).href||'',title:document.title.slice(0,900),meta:{},ld:[],dom:{}};
qa('meta').forEach(function(m){var k=m.getAttribute('property')||m.getAttribute('name')||m.getAttribute('itemprop');var v=m.getAttribute('content');
 if(k&&v&&/^(og:|product:|description$|price|pricecurrency)/i.test(k)){c.meta[k]=c.meta[k]||[];if(c.meta[k].length<20)c.meta[k].push(v.slice(0,1900));}});
qa('script[type="application/ld+json"]').forEach(function(s){var x=s.textContent||'';if(/product/i.test(x)&&c.ld.length<12)c.ld.push(x.slice(0,79000));});
try{var p=window.__myx&&window.__myx.pdpData;if(p){c.myntra={name:p.name,brand:p.brand&&{name:p.brand.name},mrp:p.mrp,price:p.price,media:p.media,
 productDetails:p.productDetails,articleAttributes:p.articleAttributes,analytics:p.analytics,baseColour:p.baseColour,countryOfOrigin:p.countryOfOrigin,
 sizes:(p.sizes||[]).slice(0,40).map(function(s){var d=(s.sizeSellerData||[])[0]||{};return {label:s.label,available:s.available,skuId:s.skuId,
  sizeSellerData:[{discountedPrice:d.discountedPrice,mrp:d.mrp}]};})};}}catch(e){}
try{var sp=window.ShopifyAnalytics&&window.ShopifyAnalytics.meta&&window.ShopifyAnalytics.meta.product;if(sp&&sp.variants)c.shopify={variants:sp.variants.slice(0,60)};}catch(e){}
if(q('#productTitle')){
 var a={title:t(q('#productTitle')),byline:t(q('#bylineInfo')).slice(0,290),availability:t(q('#availability')).slice(0,490),
  price:t(q('#corePriceDisplay_desktop_feature_div .priceToPay .a-offscreen'))||t(q('#corePrice_feature_div .a-price .a-offscreen'))||t(q('.priceToPay .a-offscreen'))||t(q('#corePrice_desktop .a-price .a-offscreen'))||t(q('.a-price .a-offscreen')),
  mrp:t(q('#corePriceDisplay_desktop_feature_div .basisPrice .a-offscreen'))||t(q('.a-text-price .a-offscreen')),
  bullets:qa('#feature-bullets li').map(t).filter(Boolean).slice(0,20).map(function(b){return b.slice(0,1900);}),
  description:t(q('#productDescription')).slice(0,7900),size:t(q('#variation_size_name .selection')).slice(0,90),specs:[],images:[],
  asin:((q('#ASIN')||q('input[name="ASIN"]')||{}).value||(location.pathname.match(/\/dp\/([A-Z0-9]{10})/)||[])[1]||'').slice(0,20)};
 var imp=q('#important-information');if(imp)a.important=t(imp).slice(0,4900);
 qa('#productDetails_techSpec_section_1 tr,#productDetails_detailBullets_sections1 tr,#productOverview_feature_div tr,#technicalSpecifications_feature_div tr').forEach(function(r){
  var k=t(r.querySelector('th,td'));var cells=r.querySelectorAll('td');var v=t(cells[cells.length-1]);if(k&&v&&k!==v&&a.specs.length<80)a.specs.push([k.slice(0,190),v.slice(0,990)]);});
 qa('#detailBullets_feature_div li').forEach(function(li){var x=t(li).split(/\s*:\s*/);if(x.length>1&&a.specs.length<80)a.specs.push([x[0].slice(0,190),x.slice(1).join(': ').slice(0,990)]);});
 var tw={};
 qa('script').forEach(function(s){var x=s.textContent||'';
  if(x.indexOf('colorImages')>=0){var re=/"hiRes":"(https:[^"]+)"|"large":"(https:[^"]+)"/g,m;while((m=re.exec(x))&&a.images.length<80)a.images.push(m[1]||m[2]);}
  if(x.indexOf('dimensionValuesDisplayData')>=0){tw.values=js(x,/"dimensionValuesDisplayData"\s*:\s*(\{[^{}]*\})/);tw.dims=js(x,/"dimensions"\s*:\s*(\[[^\]]*\])/);tw.labels=js(x,/"variationDisplayLabels"\s*:\s*(\{[^{}]*\})/);}});
 tw.swatches=qa('#twister li[data-asin],[id^="inline-twister-row-"] li[data-asin],[id^="variation_"] li[data-asin]').slice(0,300).map(function(li){
  var row=li.closest('[id^="inline-twister-row-"],[id^="variation_"]');var id=row?row.id.replace(/^inline-twister-row-|^variation_/,''):'';
  return {asin:(li.getAttribute('data-asin')||'').slice(0,20),dim:id.slice(0,60),label:t(li.querySelector('.swatch-title-text-display,.twisterTextDiv,img')||li).slice(0,190)||(li.querySelector('img')||{}).alt||'',
   price:(t(li.querySelector('.apex-pricetopay-value'))||t(li.querySelector('.a-price:not(.a-text-price) .a-offscreen,.twisterSwatchPrice'))).slice(0,90),
   mrp:t(li.querySelector('.apex-basisprice-value .a-offscreen,.a-text-price[data-a-strike="true"] .a-offscreen')).slice(0,90),
   available:!/unavailable|disabled/i.test(li.className)&&!/currently unavailable|out of stock/i.test(t(li))};}).filter(function(s){return /^[A-Z0-9]{10}$/.test(s.asin);});
 if(tw.values)a.twister=tw;
 var li=q('#landingImage');if(li&&a.images.length<80)a.images.push(li.getAttribute('data-old-hires')||li.src);
 c.delivery=t(q('#mir-layout-DELIVERY_BLOCK')||q('#deliveryBlockMessage')||q('#ddmDeliveryMessage')).slice(0,290);
 c.amazon=a;}
if(/flipkart\.com$/.test(location.hostname.replace(/^www\./,''))){
 var sel=[],links=[],seen={};
 qa('div,span').forEach(function(e){if(e.children.length>3||sel.length>=4)return;var m=(e.innerText||'').match(/^Selected ([A-Za-z ]{2,30}):\s*\n?\s*([^\n]{1,80})/);
  if(!m)return;var ax=m[1].trim();if(seen[ax])return;seen[ax]=1;sel.push([ax.slice(0,59),m[2].trim().slice(0,119)]);
  var box=e;for(var i=0;i<5&&box&&box.querySelectorAll('a[href*="pid="]').length<2;i++)box=box.parentElement;
  if(box)Array.prototype.slice.call(box.querySelectorAll('a[href*="pid="]')).forEach(function(l){var h=l.getAttribute('href')||'';
   if(h.split('?')[0]===location.pathname&&links.length<80)links.push({url:new URL(h,location.href).href.slice(0,1990),label:t(l).slice(0,190),axis:ax.slice(0,59)});});});
 if(sel.length)c.swatch={selected:sel,links:links};}
if(!c.delivery){var bt=document.body?document.body.innerText:'';var dm=bt.match(/(delivery by|get it by|delivered by|delivery in|arrives by)[^\n]{0,8}\n?[^\n]{0,60}/i);if(dm)c.delivery=dm[0].replace(/\s+/g,' ').slice(0,290);}
c.dom.images=qa('img').filter(function(i){return i.naturalWidth>=500&&i.naturalHeight>=500;}).map(function(i){return i.currentSrc||i.src;}).filter(function(u){return /^https:/.test(u)&&u.length<1900;}).slice(0,30);
c.dom.h1=t(q('h1')).slice(0,900);
return c;
})()`;

const SOURCE = `(function(){
var O='__ORIGIN__';
var c=${CAPTURE};
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

/** The capture alone, as an expression the sourcing runner evaluates in a page (it returns the RawCapture). */
export const captureScript: string = CAPTURE;
