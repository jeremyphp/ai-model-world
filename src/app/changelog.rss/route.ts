import { loadChangelog, siteUrl } from '@/lib/changelog';

/**
 * 更新日志的 RSS 2.0。静态导出时落成站点根下的 `changelog.rss`。
 * 与 /changelog/ 页读同一份 data/changelog.json，不会各说各话。
 * 条目内容用管线生成的 markdown 摘要，转义后放进 description。
 */
export const dynamic = 'force-static';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function GET() {
  const base = siteUrl();
  const entries = loadChangelog().slice(0, 30);
  const items = entries
    .map(
      (e) => `    <item>
      <title>模型世界更新速报 · ${esc(e.date)}</title>
      <link>${esc(base)}/changelog/</link>
      <guid isPermaLink="false">changelog-${esc(e.date)}</guid>
      <pubDate>${new Date(e.date).toUTCString()}</pubDate>
      <description><![CDATA[${e.summary}]]></description>
    </item>`,
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>大模型王者峡谷 · 更新日志</title>
    <link>${esc(base)}/changelog/</link>
    <description>新模型、门面换代、冠军易主——数据管线每 12 小时自动同步，这里自动记录值得注意的变化。</description>
    <language>zh-cn</language>
    <atom:link href="${esc(base)}/changelog.rss" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
}
