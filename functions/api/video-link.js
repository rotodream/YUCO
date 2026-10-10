/** コメトピ7: 既存記事に動画URLを後付け。HTMLは絶対に書き換えない。 */
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const reply=(d,status=200)=>new Response(JSON.stringify(d),{status,headers});
const enc=new TextEncoder();
const setup=e=>({owner:String(e.GITHUB_OWNER||''),repo:String(e.GITHUB_REPO||''),branch:String(e.GITHUB_BRANCH||'main'),token:String(e.GITHUB_TOKEN||''),password:String(e.ADMIN_PASSWORD||'')});
function valid(c){return !!(c.owner&&c.repo&&c.branch&&c.token&&c.password.length>=12&&/^[a-z0-9_.-]+$/i.test(c.owner)&&/^[a-z0-9_.-]+$/i.test(c.repo)&&!/\s/.test(c.branch))}
async function pass(a,b){const [x,y]=await Promise.all([crypto.subtle.digest('SHA-256',enc.encode(a)),crypto.subtle.digest('SHA-256',enc.encode(b))]);const xx=new Uint8Array(x),yy=new Uint8Array(y);let v=0;for(let i=0;i<xx.length;i++)v|=xx[i]^yy[i];return v===0}
function video(s){const val=String(s||'').trim();if(!val)return '';if(val.length>250)throw Error('URLが長すぎます');let u;try{u=new URL(val)}catch{throw Error('YouTube動画URLを指定してください')}if(u.protocol!=='https:')throw Error('HTTPSのURLを指定してください');let id='';if(['youtu.be','www.youtu.be'].includes(u.hostname))id=u.pathname.split('/')[1]||'';else if(['www.youtube.com','youtube.com','m.youtube.com'].includes(u.hostname)){if(u.pathname==='/watch')id=u.searchParams.get('v')||'';else if(/^\/(shorts|live|embed)\//.test(u.pathname))id=u.pathname.split('/')[2]||''}if(!/^[A-Za-z0-9_-]{11}$/.test(id))throw Error('YouTubeの個別動画URLを指定してください');return `https://www.youtube.com/watch?v=${id}`}
function validDate(raw){const s=String(raw||'').trim();if(!s)return '';if(!/^20\d{2}-\d{2}-\d{2}$/.test(s))throw Error('YouTube公開日はYYYY-MM-DDで入力してください');const d=new Date(s+'T00:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==s)throw Error('YouTube公開日が実在しません');return s}
class GithubError extends Error{constructor(msg,status){super(msg);this.status=status}}
async function gh(c,method,path,body){const r=await fetch(`https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}${path}`,{method,headers:{'Accept':'application/vnd.github+json','Authorization':`Bearer ${c.token}`,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'cometopi7-publisher',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new GithubError(`GitHub API: ${r.status} ${String(d.message||'').slice(0,160)}`,r.status);return d}
function unbase64(s){const b=atob(String(s||'').replace(/\s/g,''));const a=Uint8Array.from(b,c=>c.charCodeAt(0));return new TextDecoder('utf-8',{fatal:true}).decode(a)}
export async function onRequestPost({env,request,data}){
 const c=setup(env);if(!valid(c))return reply({ok:false,error:'GitHub接続と管理者設定が必要です'},503);
 const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)return reply({ok:false,error:'送信元が一致しません'},403);
 const pw=request.headers.get('X-Admin-Password')||'';if(!data?.cometopiAdminAuthenticated && (!pw||!(await pass(pw,c.password))))return reply({ok:false,error:'管理者パスワードが正しくありません'},401);
 if(Number(request.headers.get('Content-Length')||0)>2048)return reply({ok:false,error:'リクエストが長すぎます'},413);
 let body;try{body=await request.json()}catch{return reply({ok:false,error:'JSON形式が不正です'},400)}
 const id=String(body.articleId||'');if(!/^[a-f0-9]{16}$/.test(id))return reply({ok:false,error:'記事IDが不正です'},400);
 let url,published;try{url=video(body.videoUrl);published=validDate(body.videoPublishedDate)}catch(e){return reply({ok:false,error:e.message},400)}
 try{for(let i=0;i<3;i++){
 const head=await gh(c,'GET',`/git/ref/heads/${encodeURIComponent(c.branch)}`);const commit=await gh(c,'GET',`/git/commits/${head.object.sha}`);
 const f=await gh(c,'GET',`/contents/public/data/articles.json?ref=${encodeURIComponent(head.object.sha)}`);const manifest=JSON.parse(unbase64(f.content));
 if(!Array.isArray(manifest.articles))throw Error('記事一覧ファイルが不正です');const record=manifest.articles.find(a=>a.id===id);if(!record)return reply({ok:false,error:'記事が見つかりません'},404);
 // When a date is omitted for an unchanged URL, preserve its prior value.
 const videoChanged=(record.youtubeVideoUrl||'')!==url;
 const date=url ? (Object.hasOwn(body,'videoPublishedDate') ? published : (videoChanged ? '' : (record.youtubePublishedDate||''))) : '';
 if(!videoChanged && (record.youtubePublishedDate||'')===date)return reply({ok:true,unchanged:true,youtubeVideoUrl:url,youtubePublishedDate:date});
 record.youtubeVideoUrl=url;record.youtubePublishedDate=date;manifest.updatedAt=new Date().toISOString();
 const tree=await gh(c,'POST','/git/trees',{base_tree:commit.tree.sha,tree:[{path:'public/data/articles.json',mode:'100644',type:'blob',content:JSON.stringify(manifest,null,2)+'\n'}]});
 const next=await gh(c,'POST','/git/commits',{message:`コメトピ7 記事のYouTube動画リンク更新 ${id}`,tree:tree.sha,parents:[head.object.sha]});
 try{await gh(c,'PATCH',`/git/refs/heads/${encodeURIComponent(c.branch)}`,{sha:next.sha,force:false});return reply({ok:true,youtubeVideoUrl:url,youtubePublishedDate:date,commit:next.sha})}
 catch(e){if(e instanceof GithubError&&[409,422].includes(e.status)&&i<2)continue;throw e}
 }throw Error('同時更新が続きました');}
 catch(e){return reply({ok:false,error:e instanceof GithubError?e.message:`保存エラー: ${String(e.message||e).slice(0,200)}`},e instanceof GithubError?502:500)}
}
