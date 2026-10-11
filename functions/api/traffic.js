// コメトピ7: Cloudflare Web Analytics RUM のページ表示数を取得する。
// 認証トークン・設定値そのものは返さず、失敗した段階だけを返す。
const unavailable = (reason) => Response.json(
  { ok: true, available: false, reason },
  { headers: { 'Cache-Control': 'no-store' } }
);
const upstreamFailure = (reason) => Response.json(
  { ok: false, available: false, reason },
  { status: 502, headers: { 'Cache-Control': 'no-store' } }
);

function dayBounds(now) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now);
  const o = Object.fromEntries(p.map(x => [x.type, x.value]));
  const jstMidnight = Date.UTC(+o.year, +o.month - 1, +o.day) - 9 * 3600_000;
  const iso = d => new Date(d).toISOString().replace('.000Z', 'Z');
  const day = 86400_000;
  return {
    today: [iso(jstMidnight), iso(jstMidnight + day)],
    yesterday: [iso(jstMidnight - day), iso(jstMidnight)],
    month: [iso(jstMidnight - 29 * day), iso(jstMidnight + day)]
  };
}

export async function onRequestGet({ env }) {
  // 管理画面でコピー・貼り付けした際の前後の空白を除去する。
  const account = String(env.CF_ANALYTICS_ACCOUNT_ID || '').trim();
  const siteTag = String(env.CF_WEB_ANALYTICS_SITE_TAG || '').trim();
  const token = String(env.CF_ANALYTICS_READ_TOKEN || '').trim();
  if (!/^[a-fA-F0-9]{32}$/.test(account) ||
      !/^[a-fA-F0-9]{32}$/.test(siteTag) || token.length < 20) {
    return unavailable('configuration');
  }

  const bounds = dayBounds(new Date());
  // Cloudflare GraphQL の型名は String ではなく小文字の string を使用する。
  const query = `query Traffic($account: string!, $siteTag: string!, $todayStart: Time!, $todayEnd: Time!, $yesterdayStart: Time!, $yesterdayEnd: Time!, $monthStart: Time!, $monthEnd: Time!) {
  viewer { accounts(filter: {accountTag: $account}) {
  today: rumPageloadEventsAdaptiveGroups(limit: 1, filter: {siteTag: $siteTag, datetime_geq: $todayStart, datetime_lt: $todayEnd}) {count avg {sampleInterval}}
  yesterday: rumPageloadEventsAdaptiveGroups(limit: 1, filter: {siteTag: $siteTag, datetime_geq: $yesterdayStart, datetime_lt: $yesterdayEnd}) {count avg {sampleInterval}}
  month: rumPageloadEventsAdaptiveGroups(limit: 1, filter: {siteTag: $siteTag, datetime_geq: $monthStart, datetime_lt: $monthEnd}) {count avg {sampleInterval}}
  } } }`;
  const variables = {
    account, siteTag,
    todayStart: bounds.today[0], todayEnd: bounds.today[1],
    yesterdayStart: bounds.yesterday[0], yesterdayEnd: bounds.yesterday[1],
    monthStart: bounds.month[0], monthEnd: bounds.month[1]
  };

  try {
    const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables })
    });
    if (!response.ok) return upstreamFailure('cloudflare_http');
    const json = await response.json();
    if (json.errors?.length) return upstreamFailure('cloudflare_graphql');
    const data = json.data?.viewer?.accounts?.[0];
    if (!data) return unavailable('account_access');

    // Adaptive データの標本補正を行う。結果は推定ページ表示回数。
    const value = key => {
      const row = data[key]?.[0];
      if (!row) return 0;
      const count = Number(row.count);
      const sampleInterval = Number(row.avg?.sampleInterval || 1);
      return Math.round(Math.max(0, count) * (
        Number.isFinite(sampleInterval) && sampleInterval > 0 ? sampleInterval : 1
      ));
    };
    return Response.json({
      ok: true, available: true,
      today: value('today'), yesterday: value('yesterday'), month: value('month'),
      timezone: 'Asia/Tokyo', metric: 'pageviews_estimate'
    }, { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=900' } });
  } catch {
    return upstreamFailure('cloudflare_connection');
  }
}
export { dayBounds };
