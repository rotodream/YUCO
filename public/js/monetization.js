(()=>{'use strict';
const $=s=>document.querySelector(s);
const text=(el,s)=>{el.textContent=String(s??'')};
const secureUrl=s=>{try{let u=new URL(String(s||''));return u.protocol==='https:'?u.href:''}catch{return''}};
const safePath=s=>typeof s==='string'&&/^\/articles\/[0-9]{4}\/[0-9]{2}\/[A-Za-z0-9_.,-]+\.html$/.test(s)?s:'';
function makeAd(ad){if(!ad||!ad.active)return;const host=$('#ad-'+ad.id);if(!host)return;
const now=new Date().toLocaleDateString('sv-SE');if((ad.startsOn&&now<ad.startsOn)||(ad.endsOn&&now>ad.endsOn))return;
const link=secureUrl(ad.linkUrl);if(!link)return;
const a=document.createElement('a');a.href=link;a.target='_blank';a.rel='noopener sponsored';
const inner=document.createElement('div');inner.className='ad-inside';
const src=secureUrl(ad.imageUrl);if(src){const img=document.createElement('img');img.src=src;img.loading='lazy';img.alt=ad.alt||ad.title||'広告';inner.append(img)}
const copy=document.createElement('div');copy.className='ad-copy';const label=document.createElement('span');label.className='ad-label';label.textContent='PR・広告';copy.append(label);
if(ad.title){const t=document.createElement('strong');text(t,ad.title);copy.append(t)}if(ad.description){const p=document.createElement('p');text(p,ad.description);copy.append(p)}inner.append(copy);a.append(inner);host.replaceChildren(a);host.hidden=false;
}
function showFeatured(cfg){if(!Array.isArray(window.cometopiArticles))return;const all=window.cometopiArticles;const map=new Map(all.map(a=>[a.path,a]));let found=(cfg.featuredPaths||[]).map(safePath).map(p=>map.get(p)).filter(Boolean);
if(!found.length)found=all.slice(0,3);const list=$('#featured-list');if(!list)return;list.replaceChildren();for(const [i,a] of found.slice(0,5).entries()){const link=document.createElement('a');link.href=safePath(a.path)||'#';link.className='featured-row';link.target='_blank';link.rel='noopener';const n=document.createElement('span');n.className='featured-num';text(n,i+1);const t=document.createElement('span');text(t,a.title);link.append(n,t);list.append(link)}
if(!found.length){const p=document.createElement('p');p.className='featured-caption';p.textContent='記事が公開されるとここに表示されます。';list.append(p)}
const caption=$('.featured-caption');if(caption)caption.textContent=(cfg.featuredPaths||[]).length?'管理者が選んだピックアップ記事です。閲覧数ランキングではありません。':'新着記事からのピックアップです。閲覧数ランキングではありません。';}
async function start(){let cfg={featuredPaths:[],ads:[]};try{if(window.cometopiDemoConfig)cfg=window.cometopiDemoConfig;else{const r=await fetch('/data/monetization.json',{cache:'no-store'});if(r.ok)cfg=await r.json();}}catch(e){console.warn('広告設定の読込失敗',e)}for(const ad of cfg.ads||[])makeAd(ad);if(window.cometopiArticles)showFeatured(cfg);else window.addEventListener('cometopi:articlesready',()=>showFeatured(cfg));}
window.cometopiRefreshExtras=(cfg)=>{document.querySelectorAll('.ad-slot').forEach(x=>{x.hidden=true;x.replaceChildren()});for(const ad of cfg.ads||[])makeAd(ad);showFeatured(cfg)};
start();
})();
