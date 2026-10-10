/**
 * Cloudflare Pages Functions /api/publish
 * GitHub + Cloudflare PagesだけでHTML原本と記事一覧を1コミットで追加する。
 * 管理者パスワード/GitHubトークンはサーバー側環境変数のみ。
 * D1 / R2 / 外部パッケージ不要。
 */
const RESPONSE_HEADERS = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:RESPONSE_HEADERS});
const MAX_FILE=3*1024*1024, MAX_TOTAL=12*1024*1024, MAX_FILES=12;
const UTF8=new TextEncoder();
function cleanVideoUrl(s){const v=String(s||'').trim();if(!v)return '';if(v.length>250)throw Error('YouTube URLが長すぎます。');let u;try{u=new URL(v)}catch{throw Error('YouTubeの動画URLを入力してください。')}if(u.protocol!=='https:')throw Error('HTTPSのYouTube動画URLを入力してください。');let id='';if(['youtu.be','www.youtu.be'].includes(u.hostname))id=u.pathname.split('/')[1]||'';else if(['youtube.com','www.youtube.com','m.youtube.com'].includes(u.hostname)){if(u.pathname==='/watch')id=u.searchParams.get('v')||'';else if(/^\/(shorts|live|embed)\//.test(u.pathname))id=u.pathname.split('/')[2]||'';}if(!/^[a-zA-Z0-9_-]{11}$/.test(id))throw Error('YouTubeの個別動画URLを入力してください（チャンネルURLでは登録できません）。');return 'https://www.youtube.com/watch?v='+id;}

function cleanPublishedDate(raw){const s=String(raw||'').trim();if(!s)return '';if(!/^20\d{2}-\d{2}-\d{2}$/.test(s))throw Error('YouTube公開日はYYYY-MM-DDで入力してください。');const dt=new Date(s+'T00:00:00Z');if(!Number.isFinite(dt.getTime())||dt.toISOString().slice(0,10)!==s)throw Error('YouTube公開日が実在しない日付です。');return s;}
function config(env){return {
  owner:String(env.GITHUB_OWNER||'').trim(),
  repo:String(env.GITHUB_REPO||'').trim(),
  branch:String(env.GITHUB_BRANCH||'main').trim(),
  token:String(env.GITHUB_TOKEN||''),
  password:String(env.ADMIN_PASSWORD||'')
};}
function validConfig(c){return Boolean(c.owner&&c.repo&&c.branch&&c.token&&c.password.length>=12&&/^[a-z0-9_.-]+$/i.test(c.owner)&&/^[a-z0-9_.-]+$/i.test(c.repo)&&!/\s/.test(c.branch))}
async function equalSecret(a,b){const [aa,bb]=await Promise.all([crypto.subtle.digest('SHA-256',UTF8.encode(a)),crypto.subtle.digest('SHA-256',UTF8.encode(b))]);const x=new Uint8Array(aa),y=new Uint8Array(bb);let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0}
async function hashHex(bytes){const a=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));return Array.from(a,v=>v.toString(16).padStart(2,'0')).join('')}
function decodeEntities(s){return String(s||'').replace(/&(#x([a-f\d]+)|#(\d+)|amp|lt|gt|quot|apos|nbsp);/gi,(all,v,hex,dec)=>{if(hex||dec){let n=parseInt(hex||dec,hex?16:10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):all}return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}[v.toLowerCase()]||all})}
function plain(s){return decodeEntities(String(s||'').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim()}
function japanToday(){const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const obj=Object.fromEntries(parts.map(x=>[x.type,x.value]));return `${obj.year}-${obj.month}-${obj.day}`}
function articleMeta(html,bytes,sha){const rawTitle=html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1]||html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/i)?.[1]||'YouTubeコメントトピックス';
  const title=plain(rawTitle).slice(0,240)||'YouTubeコメントトピックス';
  const d=title.match(/(20\d{2})[\/-](\d{1,2})[\/-](\d{1,2})/)||html.slice(0,3000).match(/(20\d{2})[\/-](\d{1,2})[\/-](\d{1,2})/);
  let date=japanToday();if(d){const year=Number(d[1]),mo=Number(d[2]),day=Number(d[3]);const check=new Date(Date.UTC(year,mo-1,day));if(check.getUTCFullYear()===year&&check.getUTCMonth()===mo-1&&check.getUTCDate()===day)date=`${year}-${String(mo).padStart(2,'0')}-${String(day).padStart(2,'0')}`}
  const summary=plain(html.match(/<section\b[^>]*class=["'][^"']*hero[^"']*["'][^>]*>[\s\S]*?<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1]||'YouTubeコメントから反応が集まったトピックスを紹介します。').slice(0,250);
  const topics=(html.match(/<article\b[^>]*class\s*=\s*["'][^"']*\btopic\b/gi)||[]).length;
  const cats=[...html.matchAll(/カテゴリー\s*([^\s<\/]{1,40})\s*\/\s*取得時再生/g)].map(x=>plain(x[1]));
  const categories=[...new Set(cats)].slice(0,15);
  const thumb=html.match(/<img\b[^>]*\bsrc=["'](https:\/\/i\.ytimg\.com\/[^"']+)["']/i)?.[1]||'';
  const lang=html.match(/<html\b[^>]*\blang\s*=\s*["']([^"']+)["']/i)?.[1]||'ja';
  return {id:sha.slice(0,16),sha256:sha,title,date,createdAt:new Date().toISOString(),summary,
    path:`/articles/${date.slice(0,4)}/${date.slice(5,7)}/${date}_${sha.slice(0,16)}.html`,
    thumbnail:thumb,categories,topics,bytes,language:lang,visible:true};
}
function decodeBase64(content){const compact=content.replace(/\s/g,'');const bin=atob(compact);const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return new TextDecoder('utf-8',{fatal:true}).decode(bytes)}
class GithubError extends Error {constructor(message,status){super(message);this.status=status}}
async function github(c,method,path,body){const r=await fetch(`https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}${path}`,{method,headers:{'Accept':'application/vnd.github+json','Authorization':`Bearer ${c.token}`,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'cometopi7-publisher',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
const data=await r.json().catch(()=>({}));if(!r.ok)throw new GithubError(`GitHub API: ${r.status} ${String(data.message||'要求を処理できませんでした').slice(0,240)}`,r.status);return data}
async function state(c){const head=await github(c,'GET',`/git/ref/heads/${encodeURIComponent(c.branch)}`);const commit=await github(c,'GET',`/git/commits/${head.object.sha}`);
let manifest={version:1,articles:[]};try{const r=await github(c,'GET',`/contents/public/data/articles.json?ref=${encodeURIComponent(head.object.sha)}`);manifest=JSON.parse(decodeBase64(r.content))}catch(e){if(!(e instanceof GithubError && e.status===404))throw e}
if(!Array.isArray(manifest.articles))throw Error('articles.json の形式が正しくありません。');return {head:head.object.sha,baseTree:commit.tree.sha,manifest}}
export async function onRequestGet({env}){const c=config(env);return json({ready:validConfig(c),mode:'github-directory',maxFileMB:3,maxBatchMB:12})}
export async function onRequestPost({request,env,data}){
const c=config(env);if(!validConfig(c))return json({ok:false,error:'Cloudflareに管理者パスワードとGitHub接続情報がまだ設定されていません。設定ガイドを確認してください。'},503);
// Basic cross-site protection; no access token is ever sent to the browser.
const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)return json({ok:false,error:'許可されていない送信元です。'},403);
const pw=request.headers.get('X-Admin-Password')||'';if(!data?.cometopiAdminAuthenticated && (!pw||!(await equalSecret(pw,c.password))))return json({ok:false,error:'管理者パスワードが正しくありません。'},401);
const len=Number(request.headers.get('Content-Length')||0);if(len>MAX_TOTAL+1024*128)return json({ok:false,error:'一度に送れるファイルの容量を超えています。'},413);
let form;try{form=await request.formData()}catch{return json({ok:false,error:'ファイルを読み取れませんでした。'},400)}
const files=form.getAll('files').filter(f=>f && typeof f.name==='string' && typeof f.text==='function');
if(!files.length)return json({ok:false,error:'HTMLファイルを選択してください。'},400);
if(files.length>MAX_FILES)return json({ok:false,error:`一度にアップロードできるのは${MAX_FILES}件までです。`},413);
if(files.reduce((s,f)=>s+f.size,0)>MAX_TOTAL)return json({ok:false,error:'合計12MB以内にしてください。'},413);
const videoUrls=form.getAll('videoUrls');const videoDates=form.getAll('videoPublishedDates');const prepared=[];
for(const [fileIndex,file] of files.entries()){if(file.size>MAX_FILE)return json({ok:false,error:`${file.name}: 1ファイル3MB以内にしてください。`},413);
 if(!/\.html?$/i.test(file.name))return json({ok:false,error:`${file.name}: HTML形式だけに対応しています。`},400);
 const text=await file.text();if(!/<html\b/i.test(text)||!/<body\b/i.test(text)||!/<\/html\s*>/i.test(text))return json({ok:false,error:`${file.name}: 完全なHTMLとして確認できませんでした。`},400);
 if(/<base\b/i.test(text))return json({ok:false,error:`${file.name}: baseタグのあるHTMLは参照先が変わる可能性があるため、この版では受け付けません。`},400);
 const sha=await hashHex(UTF8.encode(text));const meta=articleMeta(text,file.size,sha);try{meta.youtubeVideoUrl=cleanVideoUrl(videoUrls[fileIndex]||'');meta.youtubePublishedDate=meta.youtubeVideoUrl?cleanPublishedDate(videoDates[fileIndex]||''):''}catch(e){return json({ok:false,error:`${file.name}: ${e.message}`},400)}
 prepared.push({meta,content:text,name:file.name});
}
try{
 for(let attempt=0;attempt<3;attempt++){
  const s=await state(c);const existing=new Set(s.manifest.articles.map(a=>a.sha256));
  const existingIDs=new Set(s.manifest.articles.map(a=>a.id));
  const add=[],skip=[];for(const p of prepared){if(existing.has(p.meta.sha256)||existingIDs.has(p.meta.id)||add.some(a=>a.meta.sha256===p.meta.sha256)){skip.push(p.name)}else add.push(p)}
  if(!add.length)return json({ok:true,added:[],skipped:skip,message:'同じ内容の記事はすでに登録されています。'});
  const updated={...s.manifest,version:1,updatedAt:new Date().toISOString(),articles:[...add.map(x=>x.meta),...s.manifest.articles]};
  // One atomic commit: every new HTML and articles.json are updated together.
  const entries=add.map(x=>({path:'public'+x.meta.path,mode:'100644',type:'blob',content:x.content}));
  entries.push({path:'public/data/articles.json',mode:'100644',type:'blob',content:JSON.stringify(updated,null,2)+'\n'});
  const tree=await github(c,'POST','/git/trees',{base_tree:s.baseTree,tree:entries});
  const commit=await github(c,'POST','/git/commits',{message:`コメトピ7 記事追加 ${add.length}件 (${add.map(x=>x.meta.date).join(', ')})`,tree:tree.sha,parents:[s.head]});
  try{await github(c,'PATCH',`/git/refs/heads/${encodeURIComponent(c.branch)}`,{sha:commit.sha,force:false});
   return json({ok:true,added:add.map(x=>({title:x.meta.title,path:x.meta.path,bytes:x.meta.bytes})),skipped:skip,commit:commit.sha,message:'GitHubへの保存が完了しました。Cloudflare Pagesの再公開が完了するとホームページに反映されます。'});
  }catch(e){if(e instanceof GithubError&&(e.status===409||e.status===422)&&attempt<2)continue;throw e}
 }
 throw Error('同時更新が続いたため公開できませんでした。時間を置いて再度お試しください。');
}catch(e){return json({ok:false,error:e instanceof GithubError?e.message:`公開処理エラー: ${String(e.message||e).slice(0,220)}`},e instanceof GithubError?502:500)}
}
