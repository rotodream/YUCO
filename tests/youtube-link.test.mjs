import assert from 'node:assert/strict';
import fs from 'node:fs';
import {onRequestPost as update} from '../functions/api/video-link.js';
import {onRequestPost as publish} from '../functions/api/publish.js';
const env={GITHUB_OWNER:'owner',GITHUB_REPO:'repo',GITHUB_BRANCH:'main',GITHUB_TOKEN:'TOKEN_TEST',ADMIN_PASSWORD:'testing-secret-password'};
let manifest=JSON.parse(fs.readFileSync(new URL('../public/data/articles.json', import.meta.url),'utf8'));
const initial=JSON.stringify(manifest.articles[0]);
const articleId=manifest.articles[0].id;
const originalFetch=global.fetch;
let wroteHTML=false, lastUpdateUrl=null;
global.fetch=async (u,o={})=>{
 const {pathname}=new URL(u);let d, status=200;
 if(pathname.endsWith('/git/ref/heads/main')&&o.method==='GET')d={object:{sha:'BASE'}};
 else if(pathname.endsWith('/git/commits/BASE'))d={tree:{sha:'TREE'}};
 else if(pathname.includes('/contents/public/data/articles.json'))d={content:Buffer.from(JSON.stringify(manifest)).toString('base64')};
 else if(pathname.endsWith('/git/trees')&&o.method==='POST'){
  const b=JSON.parse(o.body);assert(b.tree.every(x=>x.path==='public/data/articles.json'));wroteHTML ||= b.tree.some(x=>x.path.endsWith('.html'));
  manifest=JSON.parse(b.tree[0].content);d={sha:'TREENEW'};
 }else if(pathname.endsWith('/git/commits')&&o.method==='POST')d={sha:'NEXT'};
 else if(pathname.endsWith('/git/refs/heads/main')&&o.method==='PATCH')d={sha:'NEXT'};
 else {d={message:'no mock '+pathname};status=404}
 return new Response(JSON.stringify(d),{status,headers:{'Content-Type':'application/json'}});
};
const req=(url,password=env.ADMIN_PASSWORD)=>new Request('https://site.pages.dev/api/video-link',{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Password':password},body:JSON.stringify({articleId,videoUrl:url})});
try{
 assert.equal((await update({request:req('https://youtu.be/dQw4w9WgXcQ','bad'),env})).status,401);
 assert.equal((await update({request:req('https://evil.youtube.com/watch?v=dQw4w9WgXcQ'),env})).status,400);
 let r=await (await update({request:req('https://youtu.be/dQw4w9WgXcQ?si=abc'),env})).json();
 assert.equal(r.ok,true);assert.equal(manifest.articles[0].youtubeVideoUrl,'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
 assert.equal(manifest.articles[0].path,JSON.parse(initial).path);
 assert.equal(manifest.articles[0].date,'2026-10-10');
 assert.equal(manifest.articles[0].youtubePublishedDate,'');
 assert(!wroteHTML);
 r=await (await update({request:req(''),env})).json();assert.equal(r.ok,true);assert.equal(manifest.articles[0].youtubeVideoUrl,'');
 // Check 10/9 video publication can be linked to 10/10 article (date mismatch is permitted).
 const dateReq=new Request('https://site.pages.dev/api/video-link',{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Password':env.ADMIN_PASSWORD},body:JSON.stringify({articleId,videoUrl:'https://youtu.be/sNnJ5dzHe3I?si=abc',videoPublishedDate:'2026-10-09'})});
 r=await (await update({request:dateReq,env})).json();assert.equal(r.ok,true);assert.equal(manifest.articles[0].date,'2026-10-10');assert.equal(manifest.articles[0].youtubePublishedDate,'2026-10-09');assert.equal(manifest.articles[0].youtubeVideoUrl,'https://www.youtube.com/watch?v=sNnJ5dzHe3I');
 console.log('PASS: video-link API auth/URL validation/persist/unlink/HTML untouched/date mismatch accepted');
}finally{global.fetch=originalFetch}
