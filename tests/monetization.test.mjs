import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {onRequestPost,onRequestGet} from '../functions/api/monetization.js';
const env={GITHUB_OWNER:'example',GITHUB_REPO:'demo',GITHUB_BRANCH:'main',GITHUB_TOKEN:'not-a-real-token',ADMIN_PASSWORD:'test-password-very-long'};
const original=JSON.parse(readFileSync(new URL('../public/data/monetization.json',import.meta.url),'utf8'));
const req=(settings,password=env.ADMIN_PASSWORD)=>new Request('https://demo.pages.dev/api/monetization',{method:'POST',headers:{'X-Admin-Password':password,'Content-Type':'application/json'},body:JSON.stringify(settings)});
assert.equal((await (await onRequestGet({env})).json()).ready,true);
assert.equal((await onRequestPost({env,request:req(original,'bad')})).status,401);
assert.equal((await onRequestPost({env:{},request:req(original)})).status,503);
const bad=structuredClone(original);bad.ads[0].active=true;bad.ads[0].linkUrl='javascript:alert(1)';bad.ads[0].title='危険';
assert.equal((await onRequestPost({env,request:req(bad)})).status,400);
const malformed=structuredClone(original);malformed.featuredPaths=['/not/an/article'];
assert.equal((await onRequestPost({env,request:req(malformed)})).status,400);
const valid=structuredClone(original);valid.ads[0]={...valid.ads[0],active:true,title:'サンプル広告',linkUrl:'https://example.com/',imageUrl:'https://example.com/banner.jpg'};
let posted;
const prev=globalThis.fetch;globalThis.fetch=async (url,options)=>{let data,pathname=new URL(url).pathname;assert(!String(url).includes(env.GITHUB_TOKEN));if(pathname.endsWith('/git/ref/heads/main'))data={object:{sha:'parent'}};
else if(pathname.endsWith('/git/commits/parent'))data={tree:{sha:'tree'}};
else if(pathname.endsWith('/git/trees')){const body=JSON.parse(options.body);assert.equal(body.tree[0].path,'public/data/monetization.json');posted=JSON.parse(body.tree[0].content);data={sha:'new-tree'}}
else if(pathname.endsWith('/git/commits'))data={sha:'new-commit'};
else if(pathname.endsWith('/git/refs/heads/main')){assert.equal(JSON.parse(options.body).force,false);data={object:{sha:'new-commit'}}}
else return new Response('{}',{status:404});return Response.json(data)};
try{const r=await onRequestPost({env,request:req(valid)});assert.equal(r.status,200);assert.equal((await r.json()).ok,true);assert.equal(posted.ads[0].title,'サンプル広告');assert.equal(posted.ads.length,3);console.log('PASS: 広告設定 認証/危険URLブロック/保存コミット')}
finally{globalThis.fetch=prev}
