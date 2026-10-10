/** コメトピ7 SEO helpers: pure modules. Source article HTML remains untouched on disk. */
export function esc(s) {return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
export function txt(s) {return String(s??'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/\s+/g,' ').trim();}
export function siteOrigin(url, env={}) {
  let candidate=String(env.SITE_URL||'').trim();
  try{const u=new URL(candidate||url);if(!['https:','http:'].includes(u.protocol))throw Error('protocol');return u.origin;}
  catch{ return new URL(url).origin; }
}
export function articlePath(p){return typeof p==='string'&&/^\/articles\/20\d{2}\/\d{2}\/[a-zA-Z0-9_.,-]+\.html$/.test(p);}
export function makeSitemap(base,manifest){
  const items=[{path:'/',modified:''},{path:'/archive',modified:''},{path:'/sponsor.html',modified:''}];
  for(const a of (manifest.articles||[]))if(a.visible!==false&&articlePath(a.path))items.push({path:a.path,modified:a.createdAt||a.date||''});
  const uniq=new Set();
  const elements=items.filter(x=>{if(uniq.has(x.path))return false;uniq.add(x.path);return true}).map(x=>{
    const last=/^20\d\d-\d\d-\d\d/.test(x.modified)?`<lastmod>${esc(x.modified.slice(0,10))}</lastmod>`:'';
    return `<url><loc>${esc(base+x.path)}</loc>${last}</url>`;
  }).join('\n  ');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  ${elements}\n</urlset>\n`;
}
export function makeArchive(base,manifest,page=1){
  const list=(manifest.articles||[]).filter(a=>a.visible!==false&&articlePath(a.path)).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  const size=80,count=Math.max(1,Math.ceil(list.length/size)),pg=Math.max(1,Math.min(count,Number(page)||1));
  const cards=list.slice((pg-1)*size,pg*size).map(a=>`<li><time datetime="${esc(a.date||'')}">${esc(a.date||'')}</time><a href="${esc(a.path)}">${esc(a.title||'YouTubeコメントトピックス')}</a><p>${esc(a.summary||'')}　${Number(a.topics)||0}トピックス</p></li>`).join('');
  const nav=(pg>1?`<a href="/archive?page=${pg-1}">← 前のページ</a>`:'')+(pg<count?`<a href="/archive?page=${pg+1}">次のページ →</a>`:'');
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>過去記事一覧 ${pg}ページ目｜コメトピ7</title><meta name="description" content="コメトピ7で公開したYouTubeコメントトピックスの過去記事一覧。日付やタイトルから話題を探せます。"><link rel="canonical" href="${esc(base+'/archive'+(pg>1?'?page='+pg:''))}"><meta property="og:type" content="website"><meta property="og:title" content="コメトピ7 過去記事一覧"><link rel="stylesheet" href="/css/site.css"><style>.seo-archive{max-width:1000px;margin:auto;padding:30px 18px 100px}.seo-archive h1{font-size:clamp(26px,5vw,38px)}.seo-archive ul{list-style:none;padding:0}.seo-archive li{margin:14px 0;background:#fff;border:1px solid #f1dcec;border-radius:16px;padding:20px;box-shadow:0 4px 18px #754d6420}.seo-archive li time{display:block;color:#876785;font-size:13px}.seo-archive li a{display:block;color:#874495;font-size:17px;font-weight:750;line-height:1.7}.seo-archive li p{font-size:13px;color:#73667c;line-height:1.7}.seo-archive .page-nav{display:flex;justify-content:space-between;gap:14px;margin-top:35px}.seo-archive .page-nav a{padding:10px;background:white;border-radius:10px}</style></head><body><header class="site-head"><div class="head-inner"><a class="wordmark" href="/">✦ コメトピ7 <small>COMMENT TOPICS</small></a><nav><a href="/">ホーム</a><a href="/sponsor.html">広告掲載</a></nav></div></header><main class="seo-archive"><h1>コメトピ7 過去記事一覧</h1><p>YouTubeに集まったコメントの話題を日付・記事名から探せます。検索やカテゴリー別表示は<a href="/#search">トップページ</a>からご利用ください。</p><p>全 ${list.length} 記事 ／ ${pg} / ${count} ページ</p><ul>${cards||'<li>まだ公開記事がありません。</li>'}</ul><nav class="page-nav" aria-label="過去記事のページ送り">${nav}</nav></main><footer class="site-footer"><div class="footer-inner"><a href="/">コメトピ7 ホームへ戻る</a></div></footer></body></html>`;
}
function bodyIntro(html){const raw=html.match(/<section\b[^>]*class=["'][^"']*hero[^"']*["'][^>]*>[\s\S]*?<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1]||html.match(/<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']+)/i)?.[1]||'';return txt(raw);}
/** Inject metadata into served response only; original HTML bytes in GitHub stay identical. */
export function enhanceArticleHtml(html, requestUrl, metadata={}, preferredOrigin){
  if(!/<\/head\s*>/i.test(html))return html;
  const url=new URL(requestUrl);const root=preferredOrigin||url.origin;const canonical=root+url.pathname;
  const rawTitle=html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]||metadata.title||'YouTubeコメントトピックス';
  const title=txt(rawTitle).slice(0,200);
  const description=String(metadata.seoDescription||metadata.summary||bodyIntro(html)||'コメトピ7で注目されたYouTubeコメントの話題を紹介します。').slice(0,170);
  const d=String(metadata.createdAt||metadata.date||'');
  const date=/^20\d\d-\d\d-\d\d/.test(d)?d:undefined;
  const pic=/^https:\/\/(i\.ytimg\.com|img\.youtube\.com)\//.test(String(metadata.thumbnail||''))?metadata.thumbnail:'';
  const schema={'@context':'https://schema.org','@type':'Article',headline:title,description,url:canonical,mainEntityOfPage:canonical,publisher:{'@type':'Organization',name:'コメトピ7',url:root}};
  if(date)schema.datePublished=date;
  if(pic)schema.image=[pic];
  if(metadata.youtubeVideoUrl&&/^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/.test(metadata.youtubeVideoUrl))schema.relatedLink=[metadata.youtubeVideoUrl];
  const newTags=[];
  if(!/<link\b[^>]*rel=["']canonical["']/i.test(html))newTags.push(`<link rel="canonical" href="${esc(canonical)}">`);
  if(!/<meta\b[^>]*name=["']description["']/i.test(html))newTags.push(`<meta name="description" content="${esc(description)}">`);
  if(!/<meta\b[^>]*property=["']og:title["']/i.test(html))newTags.push(`<meta property="og:type" content="article"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical)}">${pic?`<meta property="og:image" content="${esc(pic)}">`:''}`);
  newTags.push(`<script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script>`);
  return html.replace(/<\/head\s*>/i,newTags.join('\n')+'\n</head>');
}
export async function loadManifest(env, requestUrl){
  // Cloudflare Pages asset binding; no D1 or R2. Only local project data is read.
  const url=new URL('/data/articles.json',requestUrl);
  const r=await env.ASSETS.fetch(new Request(url.toString(),{headers:{Accept:'application/json'}}));
  if(!r.ok)throw new Error('記事目録を読み込めませんでした');
  const data=await r.json();return Array.isArray(data.articles)?data:{articles:[]};
}
