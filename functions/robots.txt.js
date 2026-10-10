import {siteOrigin} from './_shared/seo.js';
export async function onRequestGet({request,env}){
 const origin=siteOrigin(request.url,env);
 // Do not block admin; its HTML contains noindex. Blocking crawling can prevent seeing noindex.
 const txt=`User-agent: *
Allow: /
Disallow: /api/
Sitemap: ${origin}/sitemap.xml
`;
 return new Response(txt,{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'public, max-age=3600'}});
}
