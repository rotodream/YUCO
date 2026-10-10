import {sessionValid,sameOrigin,respond} from './_shared/auth.js';
export async function onRequest(context){
 const {request,env,next,data}=context;const url=new URL(request.url),path=url.pathname;
 const adminPage=path==='/admin.html'||path==='/ads-admin.html';
 const writeApi=request.method!=='GET'&&request.method!=='HEAD'&&['/api/publish','/api/video-link','/api/monetization'].includes(path);
 if(!adminPage&&!writeApi)return next();
 const valid=await sessionValid(request,env);
 if(!valid){if(adminPage)return Response.redirect(url.origin+'/login.html',302);return respond({ok:false,error:'管理者ログインが必要です。'},401)}
 if(writeApi&&!sameOrigin(request))return respond({ok:false,error:'許可されていない送信元です。'},403);
 data.cometopiAdminAuthenticated=true;
 const result=await next();
 if(adminPage){const h=new Headers(result.headers);h.set('Cache-Control','private, no-store');h.set('X-Robots-Tag','noindex, nofollow');return new Response(result.body,{status:result.status,headers:h})}
 return result;
}
