(()=>{'use strict';
const $=s=>document.querySelector(s);
const els={list:$('#article-list'),keyword:$('#keyword'),category:$('#category'),month:$('#month'),count:$('#result-count'),pagination:$('#pagination')};
let articles=[],page=1;
const clean=s=>String(s??'');
const dateLabel=s=>{let d=String(s||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return d?`${d[1]}/${d[2]}/${d[3]}`:String(s||'')};
const safePath=p=>typeof p==='string'&&/^\/articles\/[0-9]{4}\/[0-9]{2}\/[a-zA-Z0-9_.,-]+\.html$/.test(p)?p:'#';
const safeImage=url=>{try{const u=new URL(url,location.origin);return u.protocol==='https:' && ['i.ytimg.com','img.youtube.com'].includes(u.hostname)?u.href:'/assets/studio-sky.png'}catch{return '/assets/studio-sky.png'}};
const validVideo=u=>typeof u==='string'&&/^https:\/\/www\.youtube\.com\/watch\?v=[a-zA-Z0-9_-]{11}$/.test(u);
const node=(tag,cls,content)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(content!==undefined)e.textContent=clean(content);return e};
function card(a){const el=node('article','article-card');const image=node('div','article-thumb');const img=node('img');img.src=safeImage(a.thumbnail);img.alt='掲載動画のサムネイル';img.loading='lazy';img.onerror=()=>{img.onerror=null;img.src='/assets/studio-sky.png'};image.append(img,node('span','day-chip',dateLabel(a.date)));el.append(image);
const info=node('div','article-info');info.append(node('h3','article-title',a.title),node('p','article-description',a.summary||'YouTubeのコメントから、返信が集まった注目のトピックスをご紹介します。'));
const chips=node('div','article-chips');chips.append(node('span','',`${Number(a.topics)||0} トピックス`));(Array.isArray(a.categories)?a.categories:[]).slice(0,3).forEach(x=>chips.append(node('span','',x)));info.append(chips);
const footer=node('div','article-footer');footer.append(node('small','',`HTML ${Math.max(1,Math.round((Number(a.bytes)||0)/1024))} KB`));const link=node('a','','記事を見る ↗');link.href=safePath(a.path);link.target='_blank';link.rel='noopener';footer.append(link);info.append(footer);
if(validVideo(a.youtubeVideoUrl)){
 const videoBar=node('div','article-video-bar');
 if(/^20\d{2}-\d{2}-\d{2}$/.test(a.youtubePublishedDate||'')) videoBar.append(node('small','youtube-date-label',`動画公開 ${dateLabel(a.youtubePublishedDate)} ／ 記事 ${dateLabel(a.date)}`));
 const view=node('a','youtube-watch','▶ コメトピ7の動画を見る ↗');view.href=a.youtubeVideoUrl;view.target='_blank';view.rel='noopener';videoBar.append(view);
 const toggle=node('button','youtube-inline-toggle','このページで再生 ▽');toggle.type='button';const panel=node('div','youtube-embed-panel');panel.hidden=true;
 toggle.onclick=()=>{if(!panel.hidden){panel.hidden=true;panel.replaceChildren();toggle.textContent='このページで再生 ▽';return}const id=new URL(a.youtubeVideoUrl).searchParams.get('v');if(!id)return;const frame=node('iframe');frame.title='コメトピ7のYouTube動画';frame.loading='lazy';frame.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';frame.referrerPolicy='strict-origin-when-cross-origin';frame.allowFullscreen=true;frame.src='https://www.youtube-nocookie.com/embed/'+id;panel.replaceChildren(frame);panel.hidden=false;toggle.textContent='動画を閉じる △'};
 videoBar.append(toggle);info.append(videoBar,panel);
}
el.append(info);return el}
// 1ページ＝暦日30日間。複数記事のある日は全件表示し、記事がない期間は空ページを作らない。
const periodDays=30,dayMs=24*60*60*1000;
function dayNumber(value){
 const text=String(value||'').slice(0,10);
 if(!/^20\d{2}-\d{2}-\d{2}$/.test(text))return null;
 const t=Date.parse(text+'T00:00:00Z');
 return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===text?t:null;
}
function periodPages(list){
 const groups=[];let current=[],firstDay=null;
 for(const article of list){
  const day=dayNumber(article.date);
  if(current.length && (day===null || firstDay===null || firstDay-day >= periodDays*dayMs)){
   groups.push(current);current=[];firstDay=null;
  }
  if(firstDay===null)firstDay=day;
  current.push(article);
 }
 if(current.length)groups.push(current);
 return groups;
}
function render(){const kw=els.keyword.value.normalize('NFKC').trim().toLowerCase();const cat=els.category.value,month=els.month.value;const filtered=articles.filter(a=>(!cat||(a.categories||[]).includes(cat))&&(!month||String(a.date).startsWith(month))&&(!kw||[a.title,a.summary,(a.categories||[]).join(' ')].join(' ').normalize('NFKC').toLowerCase().includes(kw)));
const groups=periodPages(filtered);const maxPage=Math.max(1,groups.length);page=Math.min(Math.max(1,page),maxPage);const visible=groups[page-1]||[];
els.list.replaceChildren();if(!filtered.length){els.list.append(node('div','empty-state',articles.length?'条件に合う記事はありません。条件を変えてお試しください。':'公開記事はまだありません。'))}else visible.forEach(a=>els.list.append(card(a)));
const start=visible.length?dateLabel(visible[visible.length-1].date):'',end=visible.length?dateLabel(visible[0].date):'';
els.count.textContent=filtered.length?`${filtered.length.toLocaleString('ja-JP')} 件中 ${visible.length.toLocaleString('ja-JP')} 件を表示（${start}${start===end?'':' ～ '+end}）`:'0 件の記事';
els.pagination.replaceChildren();if(maxPage>1){const prev=node('button','','← 新しい期間へ');prev.disabled=page===1;prev.onclick=()=>{page--;render();$('#articles').scrollIntoView()};const state=node('span','',`${page} / ${maxPage}（約30日分ごと）`);const next=node('button','','過去の期間へ →');next.disabled=page===maxPage;next.onclick=()=>{page++;render();$('#articles').scrollIntoView()};els.pagination.append(prev,state,next)}}
function prepare(){const cats=[...new Set(articles.flatMap(a=>Array.isArray(a.categories)?a.categories:[]))].sort((a,b)=>a.localeCompare(b,'ja'));for(const c of cats){const o=node('option','',c);o.value=c;els.category.append(o)}const months=[...new Set(articles.map(a=>String(a.date).slice(0,7)))].filter(v=>/^\d{4}-\d{2}$/.test(v)).sort().reverse();for(const m of months){const o=node('option','',m.replace('-','年')+'月');o.value=m;els.month.append(o)}$('#article-total').textContent=articles.length.toLocaleString('ja-JP');$('#topic-total').textContent=articles.reduce((sum,a)=>sum+(Number(a.topics)||0),0).toLocaleString('ja-JP');$('#last-updated').textContent=articles.length?dateLabel(articles[0].date):'—'}
async function start(){try{const r=await fetch('/data/articles.json',{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);const obj=await r.json();articles=(Array.isArray(obj.articles)?obj.articles:[]).filter(a=>a&&a.visible!==false).sort((a,b)=>String(b.date+' '+(b.createdAt||'')).localeCompare(String(a.date+' '+(a.createdAt||''))));prepare();render();window.cometopiArticles=articles;window.dispatchEvent(new Event('cometopi:articlesready'))}catch(e){els.list.replaceChildren(node('div','empty-state','記事一覧を読み込めませんでした。しばらくしてから再読み込みしてください。'));els.count.textContent='読み込みに失敗しました';console.error(e)}}
for(const k of ['keyword','category','month'])els[k].addEventListener(k==='keyword'?'input':'change',()=>{page=1;render()});$('#clear-filters').onclick=()=>{els.keyword.value='';els.category.value='';els.month.value='';page=1;render()};start();
})();
