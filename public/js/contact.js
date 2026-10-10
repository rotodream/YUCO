(()=>{'use strict';
const form=document.getElementById('contact-form');if(!form)return;
const $=id=>document.getElementById(id);const status=$('contact-status'),mode=$('contact-mode'),submit=$('contact-submit');
const address=['nsp','-nt','@','mbr','.nifty','.com'].join('');
let config=null, widgetId=null;
function message(text,isError=false){status.textContent=text;status.style.color=isError?'#ac335d':'#397c5d'}
function body(){const d=new FormData(form);return `コメトピ7 運営事務局 御中\n\nお問い合わせ区分：${d.get('category')}\nお名前・団体名：${d.get('name')||'（未入力）'}\n返信先：${d.get('email')||'（未入力）'}\n件名：${d.get('title')||'（未入力）'}\n\n${d.get('message')}`;}
function fallbackMail(){const d=new FormData(form);const subject='【コメトピ7】'+d.get('category')+' '+(d.get('title')||'お問い合わせ');const href='mailto:'+address+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body());message('メールアプリを開きます。実際の送信操作はメールアプリ側で行ってください。');location.href=href;}
function initTurnstile(siteKey){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.onload=()=>{try{if(!window.turnstile)throw new Error('Turnstile unavailable');$('turnstile-box').hidden=false;widgetId=window.turnstile.render('#turnstile-box',{sitekey:siteKey});resolve();}catch(e){reject(e)}};s.onerror=reject;document.head.append(s)})}
async function init(){try{const r=await fetch('/api/contact-config',{cache:'no-store'});if(r.ok){const c=await r.json();if(c.mode==='formspree'&&/^https:\/\/formspree\.io\/f\/[A-Za-z0-9]+$/.test(c.endpoint)&&typeof c.siteKey==='string'){await initTurnstile(c.siteKey);config=c;submit.textContent='このページから送信する ↗';mode.textContent='迷惑送信対策付きフォーム';return}}}catch(e){console.warn('Contact config unavailable',e)}mode.textContent='メールアプリを使用';submit.textContent='メールアプリで送信する ↗';}
form.addEventListener('submit',async event=>{event.preventDefault();if(!form.reportValidity())return;if($('contact-company').value)return message('送信できませんでした。',true);
if(!config){fallbackMail();return;}
const token=window.turnstile?.getResponse(widgetId);if(!token){message('迷惑送信防止の確認が完了してから送信してください。',true);return;}
const d=new FormData(form);d.set('_subject','【コメトピ7】'+d.get('category'));d.set('cf-turnstile-response',token);submit.disabled=true;message('送信しています…');
try{const r=await fetch(config.endpoint,{method:'POST',body:d,headers:{Accept:'application/json'}});if(!r.ok){let details;try{details=await r.json()}catch{};throw new Error(details?.errors?.map(x=>x.message).join(' / ')||'送信できませんでした。')}form.reset();message('お問い合わせを送信しました。ありがとうございました。');}catch(e){message('送信に失敗しました。時間をおいてお試しください。 '+(e.message||''),true)}finally{submit.disabled=false;window.turnstile?.reset(widgetId)}});
init();
})();
