import {loadManifest,makeSitemap,siteOrigin} from './_shared/seo.js';
export async function onRequestGet({request,env}){
 try{const m=await loadManifest(env,request.url);const xml=makeSitemap(siteOrigin(request.url,env),m);return new Response(xml,{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=900','X-Content-Type-Options':'nosniff'}})}
 catch(e){return new Response('Sitemap temporarily unavailable',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})}
}
