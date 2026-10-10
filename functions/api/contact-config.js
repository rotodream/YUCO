export async function onRequestGet({env}){
 const id=String(env.FORMSPREE_FORM_ID||'').trim(),key=String(env.CONTACT_TURNSTILE_SITE_KEY||'').trim();
 const enabled=/^[A-Za-z0-9]{4,32}$/.test(id)&&/^[A-Za-z0-9_-]{8,200}$/.test(key);
 return Response.json(enabled?{mode:'formspree',endpoint:'https://formspree.io/f/'+id,siteKey:key}:{mode:'mailto'},{headers:{'Cache-Control':'no-store'}});
}
