const COOKIE='cometopi7_admin';
const ttl=4*60*60;
const enc=new TextEncoder();
const safe=(x)=>String(x||'');
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Type':'application/json; charset=utf-8'};
export const respond=(body,status=200,extras={})=>new Response(JSON.stringify(body),{status,headers:{...headers,...extras}});
export function configured(env){return safe(env.ADMIN_PASSWORD).length>=12 && safe(env.ADMIN_SESSION_SECRET).length>=32;}
async function digest(password){const result=await crypto.subtle.digest('SHA-256',enc.encode(password));return new Uint8Array(result);}
export async function equalSecret(a,b){const x=await digest(safe(a)),y=await digest(safe(b));let delta=0;for(let i=0;i<x.length;i++)delta|=x[i]^y[i];return delta===0;}
async function key(env){return crypto.subtle.importKey('raw',enc.encode(safe(env.ADMIN_SESSION_SECRET)),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
const urlbase64=(bytes)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const debase=(v)=>{if(!/^[A-Za-z0-9_-]+$/.test(v))return null;try{return Uint8Array.from(atob(v.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-v.length%4)%4)),c=>c.charCodeAt(0))}catch{return null}};
export async function makeCookie(env,now=Date.now()){
 const value=`v1.${Math.floor(now/1000)}.${urlbase64(crypto.getRandomValues(new Uint8Array(18)))}`;
 const signed=new Uint8Array(await crypto.subtle.sign('HMAC',await key(env),enc.encode(value)));
 return `${COOKIE}=${value}.${urlbase64(signed)}; Path=/; Max-Age=${ttl}; HttpOnly; Secure; SameSite=Strict`;
}
export const clearCookie=()=>`${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
export async function sessionValid(request,env,now=Date.now()){
 if(!configured(env))return false;
 const match=(request.headers.get('Cookie')||'').match(/(?:^|;\s*)cometopi7_admin=([^;]+)/);if(!match)return false;
 const parts=match[1].split('.');if(parts.length!==4||parts[0]!=='v1')return false;
 const iat=Number(parts[1]);const nowS=Math.floor(now/1000);
 if(!Number.isSafeInteger(iat)||iat>nowS+60||iat<nowS-ttl)return false;
 const sig=debase(parts[3]);if(!sig||sig.length!==32)return false;
 return crypto.subtle.verify('HMAC',await key(env),sig,enc.encode(parts.slice(0,3).join('.')));
}
export function sameOrigin(request){const origin=request.headers.get('Origin');if(origin && origin!==new URL(request.url).origin)return false;
 const site=request.headers.get('Sec-Fetch-Site');return !site || ['same-origin','none'].includes(site);
}
