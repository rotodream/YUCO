import {loadManifest,enhanceArticleHtml,articlePath,siteOrigin} from '../_shared/seo.js';
export async function onRequestGet({request,env,next}){
 const path=new URL(request.url).pathname;
 const response=await next();
 if(!response.ok||!articlePath(path)||!(response.headers.get('content-type')||'').includes('text/html'))return response;
 try{
  const m=await loadManifest(env,request.url);
  const entry=m.articles.find(a=>a.path===path);
  if(entry&&entry.visible===false)return new Response('この記事は非公開です。',{status:404,headers:{'Content-Type':'text/plain; charset=utf-8','X-Robots-Tag':'noindex'}});
  const updated=enhanceArticleHtml(await response.text(),request.url,entry||{},siteOrigin(request.url,env));
  const headers=new Headers(response.headers);
  for(const k of ['content-length','content-encoding','etag'])headers.delete(k);
  headers.set('Content-Type','text/html; charset=utf-8');
  headers.set('Content-Security-Policy',"sandbox allow-popups allow-popups-to-escape-sandbox; base-uri 'none'; object-src 'none'");
  return new Response(updated,{status:response.status,headers});
 }catch{ return response; }
}
