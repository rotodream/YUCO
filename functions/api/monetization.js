/** コメトピ7広告設定 — GitHubにJSONを1コミット保存。D1/R2不要。 */
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const response=(o,status=200)=>new Response(JSON.stringify(o),{status,headers});
const UTF8=new TextEncoder();
function cfg(env){return {owner:String(env.GITHUB_OWNER||'').trim(),repo:String(env.GITHUB_REPO||'').trim(),branch:String(env.GITHUB_BRANCH||'main').trim(),token:String(env.GITHUB_TOKEN||''),password:String(env.ADMIN_PASSWORD||'')}}
function ready(c){return !!(c.owner&&c.repo&&c.token&&c.password.length>=12&&/^[a-z0-9_.-]+$/i.test(c.owner)&&/^[a-z0-9_.-]+$/i.test(c.repo)&&c.branch&&!/\s/.test(c.branch))}
async function equal(a,b){const [x,y]=await Promise.all([crypto.subtle.digest('SHA-256',UTF8.encode(a)),crypto.subtle.digest('SHA-256',UTF8.encode(b))]);const A=new Uint8Array(x),B=new Uint8Array(y);let diff=0;for(let i=0;i<A.length;i++)diff|=A[i]^B[i];return diff===0}
class GithubError extends Error{constructor(msg,status){super(msg);this.status=status}}
async function github(c,method,path,body){const r=await fetch(`https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}${path}`,{method,headers:{'Accept':'application/vnd.github+json','Authorization':`Bearer ${c.token}`,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'cometopi7-ad-manager',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json().catch(()=>({}));if(!r.ok)throw new GithubError(`GitHub API: ${r.status} ${String(data.message||'通信エラー').slice(0,150)}`,r.status);return data}
function text(s,max){if(typeof s!=='string'||s.length>max)throw Error(`入力項目が長すぎます（最大${max}文字）。`);return s.trim()}
function httpsUrl(s){const str=text(s,2048);if(!str)return '';let u;try{u=new URL(str)}catch{throw Error('広告のURLを確認してください。')}if(u.protocol!=='https:'||u.username||u.password)throw Error('広告のリンク・画像URLはHTTPSのみ使用できます。');return str}
function date(s){s=text(s,10);if(!s)return '';if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||new Date(`${s}T00:00:00Z`).toISOString().slice(0,10)!==s)throw Error('掲載日付が正しくありません。');return s}
function normalize(data){if(!data||typeof data!=='object'||Array.isArray(data))throw Error('設定形式が正しくありません。');const sp=data.sponsor||{};
const contactEmail=text(sp.contactEmail||'',180);if(contactEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))throw Error('スポンサー窓口のメールアドレスを確認してください。');
if(!Array.isArray(data.featuredPaths)||data.featuredPaths.length>5)throw Error('注目記事は最大5件です。');
const featuredPaths=data.featuredPaths.map(p=>text(p,230));if(featuredPaths.some(s=>!/^\/articles\/[0-9]{4}\/[0-9]{2}\/[a-zA-Z0-9_.,-]+\.html$/.test(s)))throw Error('注目記事のパスを確認してください。');
if(!Array.isArray(data.ads)||data.ads.length!==3)throw Error('広告枠の数が正しくありません。');const seen=new Set();const ads=data.ads.map(a=>{
if(!a||!['top','middle','bottom'].includes(a.id)||seen.has(a.id))throw Error('広告枠の識別子を確認してください。');seen.add(a.id);
const out={id:a.id,active:a.active===true,title:text(a.title||'',90),description:text(a.description||'',200),imageUrl:httpsUrl(a.imageUrl||''),linkUrl:httpsUrl(a.linkUrl||''),alt:text(a.alt||'',100),startsOn:date(a.startsOn||''),endsOn:date(a.endsOn||'')};
if(out.startsOn&&out.endsOn&&out.startsOn>out.endsOn)throw Error('終了日は開始日以降にしてください。');
if(out.active&&(!out.linkUrl||(!out.title&&!out.imageUrl)))throw Error('掲載する広告にはリンク先と、タイトルまたは画像が必要です。');return out;
});return {version:1,updatedAt:new Date().toISOString(),sponsor:{contactEmail,message:text(sp.message||'',400)},featuredPaths,ads};}
export async function onRequestGet({env}){return response({ready:ready(cfg(env)),mode:'github-json'})}
export async function onRequestPost({env,request,data}){const c=cfg(env);if(!ready(c))return response({ok:false,error:'GitHub連携または管理者パスワードが設定されていません。'},503);
const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)return response({ok:false,error:'許可されていない送信元です。'},403);
const password=request.headers.get('X-Admin-Password')||'';if(!data?.cometopiAdminAuthenticated && (!password||!(await equal(password,c.password))))return response({ok:false,error:'管理者パスワードが正しくありません。'},401);
const body=await request.text();if(UTF8.encode(body).length>22000)return response({ok:false,error:'設定の容量が大きすぎます。'},413);
let settings;try{settings=normalize(JSON.parse(body))}catch(e){return response({ok:false,error:String(e.message||e).slice(0,300)},400)}
try{for(let attempt=0;attempt<3;attempt++){
const ref=await github(c,'GET',`/git/ref/heads/${encodeURIComponent(c.branch)}`);const commit=await github(c,'GET',`/git/commits/${ref.object.sha}`);
const tree=await github(c,'POST','/git/trees',{base_tree:commit.tree.sha,tree:[{path:'public/data/monetization.json',mode:'100644',type:'blob',content:JSON.stringify(settings,null,2)+'\n'}]});
const update=await github(c,'POST','/git/commits',{message:'コメトピ7 広告・スポンサー設定更新',tree:tree.sha,parents:[ref.object.sha]});
try{await github(c,'PATCH',`/git/refs/heads/${encodeURIComponent(c.branch)}`,{sha:update.sha,force:false});return response({ok:true,commit:update.sha,message:'GitHubへ広告設定を保存しました。Cloudflareへの反映は再デプロイ後です。'})}catch(e){if(e instanceof GithubError&&(e.status===409||e.status===422)&&attempt<2)continue;throw e}
}return response({ok:false,error:'同時更新が続いたため再試行してください。'},409)}catch(e){return response({ok:false,error:String(e.message||e).slice(0,240)},502)}}
