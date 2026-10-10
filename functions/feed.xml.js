import {loadManifest,siteOrigin,esc,articlePath} from './_shared/seo.js';
export async function onRequestGet({request,env}){
 try{const data=await loadManifest(env,request.url);const base=siteOrigin(request.url,env);
 const entries=data.articles.filter(a=>a.visible!==false&&articlePath(a.path)).slice(0,40).map(a=>`<item><title>${esc(a.title)}</title><link>${esc(base+a.path)}</link><guid isPermaLink="true">${esc(base+a.path)}</guid><description>${esc(a.summary||'')}</description>${a.createdAt&&!Number.isNaN(Date.parse(a.createdAt))?`<pubDate>${new Date(a.createdAt).toUTCString()}</pubDate>`:''}</item>`).join('');
 return new Response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>コメトピ7 最新記事</title><link>${esc(base)}</link><description>コメトピ7で公開されたYouTubeコメントトピックス</description><language>ja</language>${entries}</channel></rss>`,{headers:{'Content-Type':'application/rss+xml; charset=utf-8','Cache-Control':'public, max-age=900'}});
 }catch{return new Response('Feed unavailable',{status:503})}
}
