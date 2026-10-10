import {configured,sessionValid,respond} from '../../_shared/auth.js';
export async function onRequestGet({request,env}){return respond({configured:configured(env),authenticated:await sessionValid(request,env)})}
