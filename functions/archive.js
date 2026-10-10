import {loadManifest,makeArchive,siteOrigin} from './_shared/seo.js';
export async function onRequestGet({request,env}){
 try{const m=await loadManifest(env,request.url);const pg=Number(new URL(request.url).searchParams.get('page')||1);const html=makeArchive(siteOrigin(request.url,env),m,pg);return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=300','X-Content-Type-Options':'nosniff'}})}
 catch{ return new Response('現在、過去記事一覧を読み込めません。',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}}) }
}
