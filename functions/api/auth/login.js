import {configured,equalSecret,makeCookie,sameOrigin,respond} from '../../_shared/auth.js';
export async function onRequestPost({request,env}){
 if(!sameOrigin(request))return respond({ok:false,error:'送信元が一致しません。'},403);
 if(!configured(env))return respond({ok:false,error:'管理者認証の初期設定が必要です。'},503);
 if(Number(request.headers.get('Content-Length')||0)>2048)return respond({ok:false,error:'入力が長すぎます。'},413);
 let data;try{data=await request.json()}catch{return respond({ok:false,error:'入力を確認してください。'},400)}
 if(!(await equalSecret(data?.password,env.ADMIN_PASSWORD)))return respond({ok:false,error:'パスワードが正しくありません。'},401);
 return respond({ok:true},200,{'Set-Cookie':await makeCookie(env)});
}
