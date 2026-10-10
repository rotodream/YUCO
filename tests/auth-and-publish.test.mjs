import assert from 'node:assert/strict';
import fs from 'node:fs';
import {onRequest as guard} from '../functions/_middleware.js';
import {onRequestPost as login} from '../functions/api/auth/login.js';
import {onRequestGet as status} from '../functions/api/auth/status.js';
import {onRequestPost as logout} from '../functions/api/auth/logout.js';
import {onRequestPost as publish} from '../functions/api/publish.js';
import {sessionValid,makeCookie} from '../functions/_shared/auth.js';
const origin='https://cometopi7.pages.dev';
const env={ADMIN_PASSWORD:'a-strong-password-is-required',ADMIN_SESSION_SECRET:'v5-example-very-long-random-secret-value-48-characters',GITHUB_OWNER:'example',GITHUB_REPO:'cometopi7',GITHUB_BRANCH:'main',GITHUB_TOKEN:'TEST_TOKEN'};
const req=(path,init={})=>new Request(origin+path,init);
const bad=await login({env,request:req('/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({password:'wrong'})})});
assert.equal(bad.status,401);assert(!bad.headers.get('set-cookie'));
const badOrigin=await login({env,request:req('/api/auth/login',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:JSON.stringify({password:env.ADMIN_PASSWORD})})});assert.equal(badOrigin.status,403);
const good=await login({env,request:req('/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({password:env.ADMIN_PASSWORD})})});assert.equal(good.status,200);
const cookie=good.headers.get('set-cookie');assert(cookie.includes('HttpOnly')&&cookie.includes('Secure')&&cookie.includes('SameSite=Strict'));const authCookie=cookie.split(';')[0];
assert.equal((await status({env,request:req('/api/auth/status',{headers:{Cookie:authCookie}})})).status,200);
assert.equal((await (await status({env,request:req('/api/auth/status',{headers:{Cookie:authCookie}})})).json()).authenticated,true);
assert.equal(await sessionValid(req('/admin.html',{headers:{Cookie:authCookie}}),env),true);
assert.equal(await sessionValid(req('/admin.html',{headers:{Cookie:authCookie.replace(/.$/,'Z')}}),env),false);
const oldCookie=(await makeCookie(env,Date.now()-5*60*60*1000)).split(';')[0];assert.equal(await sessionValid(req('/admin.html',{headers:{Cookie:oldCookie}}),env),false);
const publicNext=()=>new Response('<h1>ADMIN</h1>',{headers:{'Content-Type':'text/html'}});
const blocked=await guard({env,data:{},request:req('/admin.html'),next:publicNext});assert.equal(blocked.status,302);assert.equal(blocked.headers.get('location'),origin+'/login.html');
const admitted=await guard({env,data:{},request:req('/admin.html',{headers:{Cookie:authCookie}}),next:publicNext});assert.equal(admitted.status,200);assert.equal(admitted.headers.get('Cache-Control'),'private, no-store');
const actions=async(init,data={})=>guard({env,data,request:req('/api/publish',init),next:()=>new Response('pass-through')});
assert.equal((await actions({method:'POST',body:'x'})).status,401);
assert.equal((await actions({method:'POST',headers:{Cookie:authCookie,Origin:'https://evil.example'},body:'x'})).status,403);
const html=fs.readFileSync(new URL('../public/articles/2026/10/youtube_comment_topics_web_2026-10-10_12-50-29-330.html',import.meta.url),'utf8').replace('返信が集まったコメントから','【登録動作の疑似テスト】返信が集まったコメントから');
let manifest=JSON.parse(fs.readFileSync(new URL('../public/data/articles.json',import.meta.url),'utf8'));
const previousFetch=globalThis.fetch;let commits=0;
globalThis.fetch=async(url,opts={})=>{
 const path=new URL(url).pathname;let body={};let code=200;
 if(path.endsWith('/git/ref/heads/main')&&opts.method==='GET')body={object:{sha:'OLD'}};
 else if(path.endsWith('/git/commits/OLD'))body={tree:{sha:'BASE'}};
 else if(path.includes('/contents/public/data/articles.json'))body={content:Buffer.from(JSON.stringify(manifest)).toString('base64')};
 else if(path.endsWith('/git/trees')&&opts.method==='POST'){
  const tree=JSON.parse(opts.body).tree;assert(tree.some(e=>e.path==='public/data/articles.json'));const added=tree.find(e=>e.path.endsWith('.html'));assert.equal(added.content,html);manifest=JSON.parse(tree.find(e=>e.path==='public/data/articles.json').content);body={sha:'TREE'};
 }else if(path.endsWith('/git/commits')&&opts.method==='POST'){body={sha:'NEW'};commits++}
 else if(path.endsWith('/git/refs/heads/main')&&opts.method==='PATCH')body={object:{sha:'NEW'}};
 else{body={message:'No route'};code=404}
 return new Response(JSON.stringify(body),{status:code,headers:{'Content-Type':'application/json'}});
};
try{
 const form=new FormData();form.append('files',new File([html],'daily.html',{type:'text/html'}));form.append('videoUrls','https://youtu.be/sNnJ5dzHe3I');form.append('videoPublishedDates','2026-10-09');
 const context={env,request:req('/api/publish',{method:'POST',headers:{Cookie:authCookie,Origin:origin},body:form}),data:{}};
 const res=await guard({...context,next:()=>publish(context)});assert.equal(res.status,200);const j=await res.json();assert.equal(j.ok,true);assert.equal(j.added.length,1);assert.equal(commits,1);assert.equal(manifest.articles[0].youtubeVideoUrl,'https://www.youtube.com/watch?v=sNnJ5dzHe3I');assert.equal(manifest.articles[0].youtubePublishedDate,'2026-10-09');
}finally{globalThis.fetch=previousFetch}
const loggedOut=await logout({request:req('/api/auth/logout',{method:'POST',headers:{Origin:origin}})});assert.equal(loggedOut.status,200);assert(loggedOut.headers.get('set-cookie').includes('Max-Age=0'));
console.log('PASS: 4-hour signed cookie, rejected invalid auth, admin route gate, CSRF, GitHub upload under logged-in session');
