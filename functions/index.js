import {esc,siteOrigin} from './_shared/seo.js';
/** Render-time absolute canonical/Open Graph for the top page, without changing design. */
export async function onRequestGet({request,env}){
 const response=await env.ASSETS.fetch(request);
 if(!response.ok||!(response.headers.get('content-type')||'').includes('text/html'))return response;
 const base=siteOrigin(request.url,env);
 let html=await response.text();
 html=html.replace(/<link rel="canonical" href="\/">/,`<link rel="canonical" href="${esc(base+'/')}">`);
 const tags=[`<meta property="og:url" content="${esc(base+'/')}">`,`<meta property="og:image" content="${esc(base+'/assets/hero-girls.png')}">`,`<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'WebSite',name:'コメトピ7',url:base+'/',description:'YouTubeコメントトピックスの検索・アーカイブ',publisher:{'@type':'Organization',name:'コメトピ7',url:base+'/'}})}</script>`];
 html=html.replace(/<\/head>/i,tags.join('\n')+'\n</head>');
 const headers=new Headers(response.headers);for(const h of ['content-length','content-encoding','etag'])headers.delete(h);
 return new Response(html,{status:response.status,headers});
}
