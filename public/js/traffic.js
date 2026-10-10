(()=>{'use strict';
const targets=['today','yesterday','month'];const status=document.getElementById('traffic-status');if(!status)return;
async function load(){try{const r=await fetch('/api/traffic',{cache:'no-store'});if(!r.ok)throw new Error('集計取得失敗');const j=await r.json();if(!j.ok||!j.available){status.textContent='アクセス計測の連携待ちです（公開後に設定します）。';return;}
for(const key of targets){const el=document.getElementById('traffic-'+key);if(el&&Number.isFinite(j[key]))el.textContent=Math.max(0,Math.round(j[key])).toLocaleString('ja-JP');}
status.textContent='Cloudflare Web AnalyticsによるPV参考値（日本時間・定期更新）';}
catch(e){status.textContent='現在、アクセス数を取得できません。時間をおいて再表示してください。';}}
load();
})();
