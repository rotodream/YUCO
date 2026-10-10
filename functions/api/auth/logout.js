import {clearCookie,sameOrigin,respond} from '../../_shared/auth.js';
export async function onRequestPost({request}){if(!sameOrigin(request))return respond({ok:false},403);return respond({ok:true},200,{'Set-Cookie':clearCookie()})}
