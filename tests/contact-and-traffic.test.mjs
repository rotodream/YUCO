import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {onRequestGet as contactConfig} from '../functions/api/contact-config.js';
import {onRequestGet as traffic, dayBounds} from '../functions/api/traffic.js';
const empty=await contactConfig({env:{}});assert.equal((await empty.json()).mode,'mailto');
const ready=await contactConfig({env:{FORMSPREE_FORM_ID:'mabcd123',CONTACT_TURNSTILE_SITE_KEY:'0x4AAAA1111111111'}});assert.equal((await ready.json()).mode,'formspree');
const noAnalytics=await traffic({env:{}});assert.equal((await noAnalytics.json()).available,false);
const d=dayBounds(new Date('2026-10-10T08:00:00.000Z'));assert.equal(d.today[0],'2026-10-09T15:00:00Z');assert.equal(d.yesterday[0],'2026-10-08T15:00:00Z');
const old=globalThis.fetch;try{
 let query='';globalThis.fetch=async (_url,opts)=>{const data=JSON.parse(opts.body);query=data.query;assert.equal(data.variables.todayStart,'2026-10-09T15:00:00Z','current date dependent - may fail after date changes');return Response.json({data:{viewer:{accounts:[{today:[{count:5,avg:{sampleInterval:1}}],yesterday:[{count:11,avg:{sampleInterval:1}}],month:[{count:30,avg:{sampleInterval:2}}]}]}}})};
 // Test with actual date; the fixed-date formatting assertion is done above.
 globalThis.fetch=async (_url,opts)=>{query=JSON.parse(opts.body).query;return Response.json({data:{viewer:{accounts:[{today:[{count:5,avg:{sampleInterval:1}}],yesterday:[{count:11,avg:{sampleInterval:1}}],month:[{count:30,avg:{sampleInterval:2}}]}]}}})};
 const result=await traffic({env:{CF_ANALYTICS_ACCOUNT_ID:'a'.repeat(32),CF_WEB_ANALYTICS_SITE_TAG:'b'.repeat(32),CF_ANALYTICS_READ_TOKEN:'c'.repeat(24)}});const stats=await result.json();assert.equal(stats.available,true);assert.equal(stats.today,5);assert.equal(stats.yesterday,11);assert.equal(stats.month,60);assert(query.includes('rumPageloadEventsAdaptiveGroups'));
}finally{globalThis.fetch=old}
const page=readFileSync(new URL('../public/contact.html',import.meta.url),'utf8');assert(page.includes('contact-kind'));assert(page.includes('contact-message'));assert(page.includes('contact-consent'));
console.log('contact / live traffic mock tests passed');
