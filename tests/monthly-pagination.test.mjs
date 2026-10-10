import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const js=fs.readFileSync(new URL('../public/js/site.js',import.meta.url),'utf8');
const code=js.slice(js.indexOf('const periodDays='),js.indexOf('function render(){'));
const ctx=vm.createContext({Date,Number,String,RegExp});
vm.runInContext(code,ctx);
const paginate=articles=>JSON.parse(JSON.stringify(vm.runInContext('periodPages('+JSON.stringify(articles)+')',ctx)));
const make=(date,n=1)=>Array.from({length:n},(_,i)=>({date,id:date+'-'+i}));
assert.deepEqual(paginate(make('2026-10-10')).map(p=>p.length),[1]);
let days=[];for(let i=0;i<63;i++){const date=new Date(Date.UTC(2026,9,10-i)).toISOString().slice(0,10);days.push(...make(date));}
assert.deepEqual(paginate(days).map(x=>x.length),[30,30,3]);
const multiple=[...make('2026-10-10',4),...make('2026-09-11',3),...make('2026-09-10',5)];
assert.deepEqual(paginate(multiple).map(x=>x.length),[7,5]);
const gaps=[...make('2026-10-10',1),...make('2024-01-10',1)];
assert.deepEqual(paginate(gaps).map(x=>x.length),[1,1]);
assert.equal(paginate([]).length,0);
assert.equal(fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8').includes('直近約30日分'),true);
console.log('PASS: 30日表示 / 複数投稿 / 過去期間 / 空期間スキップ / 0件');
