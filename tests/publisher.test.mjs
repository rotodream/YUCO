import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {onRequestPost,onRequestGet} from '../functions/api/publish.js';
const env={GITHUB_OWNER:'example',GITHUB_REPO:'cometopi7-site',GITHUB_BRANCH:'main',GITHUB_TOKEN:'EXAMPLE_PRIVATE_TOKEN_FOR_TEST',ADMIN_PASSWORD:'a-long-admin-password-for-test'};
const original=fs.readFileSync(new URL('../public/articles/2026/10/youtube_comment_topics_web_2026-10-10_12-50-29-330.html', import.meta.url),'utf8');
const seed=JSON.parse(fs.readFileSync(new URL('../public/data/articles.json',import.meta.url),'utf8'));
const withData=async (password,html=original,name='test.html')=>{
 const form=new FormData();form.append('files',new File([html],name,{type:'text/html'}));
 return onRequestPost({request:new Request('https://example.pages.dev/api/publish',{method:'POST',headers:{'X-Admin-Password':password},body:form}),env});
};
assert.equal((await (await onRequestGet({env})).json()).ready,true);
assert.equal((await (await withData('wrong')).status),401);
assert.equal((await (await onRequestPost({request:new Request('https://example.pages.dev/api/publish',{method:'POST'}),env:{}})).status),503);
const apiRequests=[];let currentManifest=seed;
const originalFetch=globalThis.fetch;
globalThis.fetch=async (url,opts={})=>{
 assert(!String(url).includes('EXAMPLE_PRIVATE_TOKEN_FOR_TEST'),'token must not be in URL');
 apiRequests.push({url:String(url),method:opts.method});
 const u=new URL(url),path=u.pathname;let data={},status=200;
 if(path.endsWith('/git/ref/heads/main') && opts.method==='GET') data={object:{sha:'PARENT'}};
 else if(path.endsWith('/git/commits/PARENT'))data={tree:{sha:'TREE_PARENT'}};
 else if(path.includes('/contents/public/data/articles.json'))data={content:Buffer.from(JSON.stringify(currentManifest),'utf8').toString('base64')};
 else if(path.endsWith('/git/trees') && opts.method==='POST'){
   const body=JSON.parse(opts.body);assert.equal(body.base_tree,'TREE_PARENT');
   assert(body.tree.some(e=>e.path==='public/data/articles.json'));
   assert(body.tree.some(e=>e.path.includes('/articles/')));
   const htmlEntry=body.tree.find(e=>e.path.includes('/articles/'));assert(htmlEntry.content.includes('<html'));
   const m=body.tree.find(e=>e.path==='public/data/articles.json');currentManifest=JSON.parse(m.content);
   data={sha:'TREE_CREATED'};
 } else if(path.endsWith('/git/commits')&&opts.method==='POST'){
   const b=JSON.parse(opts.body);assert.deepEqual(b.parents,['PARENT']);assert.equal(b.tree,'TREE_CREATED');data={sha:'COMMIT_CREATED'};
 }else if(path.endsWith('/git/refs/heads/main')&&opts.method==='PATCH'){
   const b=JSON.parse(opts.body);assert.equal(b.force,false);data={object:{sha:'COMMIT_CREATED'}};
 }else{status=404;data={message:'unknown API '+path}}
 return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
};
try{
 // Original sample already exists; no Git write should happen.
 const duplicate=await (await withData(env.ADMIN_PASSWORD)).json();assert.equal(duplicate.ok,true);assert.equal(duplicate.added.length,0);assert.equal(duplicate.skipped.length,1);
 const modified=original.replace('返信が集まったコメントから','【テスト】返信が集まったコメントから');
 const publish=await (await withData(env.ADMIN_PASSWORD,modified,'another.html')).json();
 assert.equal(publish.ok,true);assert.equal(publish.added.length,1);
 const latest=currentManifest.articles[0];assert.equal(latest.topics,20);assert(latest.categories.includes('ゲーム'));assert(latest.categories.includes('音楽'));
 assert.equal(latest.bytes,Buffer.byteLength(modified,'utf8'));
 assert.equal(latest.sha256,crypto.createHash('sha256').update(modified).digest('hex'));
 assert.equal(currentManifest.articles.length,2);
 const repeat=await (await withData(env.ADMIN_PASSWORD,modified,'another.html')).json();assert.equal(repeat.added.length,0);
 assert.equal(apiRequests.filter(e=>e.method==='PATCH').length,1);
 console.log('PASS: 認証・サンプル重複防止・単一コミット公開・目録更新・原文保存・カテゴリ・容量');
}finally{globalThis.fetch=originalFetch}
