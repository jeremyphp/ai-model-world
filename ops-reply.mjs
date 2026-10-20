// 在 nodeloc 主题 114559 回帖（感谢 + 告知人民币切换已上线）
import fs from 'node:fs';

const state = JSON.parse(fs.readFileSync('E:/AI123/nodeloc-state.json', 'utf8'));
const cookieHeader = (state.cookies ?? [])
  .filter((c) => c.domain.includes('nodeloc'))
  .map((c) => `${c.name}=${c.value}`)
  .join('; ');

const TOPIC = 114559;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36';

const csrfRes = await fetch('https://www.nodeloc.com/session/csrf', {
  headers: { Cookie: cookieHeader, Accept: 'application/json', 'User-Agent': UA },
});
const csrf = (await csrfRes.json()).csrf;

const body = `@blackshark 好建议，已经加上了。

价格雷达右上角多了个「￥转人民币」按钮，点一下所有价格按 1 美元 ≈ 7.1 元换算显示，选择会记住。

汇率是写死的参考值（没接实时汇率 API，因为这个站刻意做到零运行时依赖、零 API 密钥），页面上也标了「参考汇率」。如果你需要精确到当天的汇率，我可以改成每天随数据同步时一起更新。

顺便：如果发现哪个家族的最低价明显不对，直接在这里说，我按你给的渠道去核对数据源。`;

const payload = {
  raw: body,
  topic_id: TOPIC,
  reply_to_post_number: 5,
  archetype: 'regular',
};

const r = await fetch(`https://www.nodeloc.com/posts.json`, {
  method: 'POST',
  headers: {
    Cookie: cookieHeader,
    'X-CSRF-Token': csrf,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': UA,
    Referer: `https://www.nodeloc.com/t/topic/${TOPIC}`,
  },
  body: JSON.stringify(payload),
});
const t = await r.text();
console.log('回帖:', r.status);
try {
  const j = JSON.parse(t);
  console.log('post id:', j.id, '| 楼层:', j.post_number);
} catch {
  console.log(t.slice(0, 300));
}
