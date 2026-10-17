/**
 * DOM-level verification of the 王者荣耀 theme: checks the key visual elements
 * are present with expected computed styles. Usage:
 *   npx tsx scripts/qa/verify-theme.ts [baseUrl]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4321';
const fail: string[] = [];

async function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' · ' + detail : ''}`);
  if (!ok) fail.push(name);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });

  check('站名', (await page.textContent('h1'))?.includes('大模型王者峡谷') ?? false, (await page.textContent('h1'))?.trim());
  check('导航「峡谷」', (await page.textContent('nav'))?.includes('峡谷') ?? false);
  check('冠军区标题「峡谷之巅」', (await page.textContent('#section-champions'))?.includes('峡谷之巅') ?? false);

  // 王者荣耀风的四枚金菱角饰（SectionFrame 内 rotate-45 的金色小方框）
  const diamonds = await page.$eval('section[aria-labelledby="section-champions"]', (el) =>
    el.querySelectorAll('span.rotate-45').length,
  );
  check('金菱角饰 ≥ 4', diamonds >= 4, `count=${diamonds}`);

  // 冠军领奖台：金色渐变台座
  const podium = await page.$eval('section[aria-labelledby="section-champions"] .absolute.bottom-0', (el) =>
    getComputedStyle(el).backgroundImage,
  );
  check('金色领奖台渐变', podium.includes('f2cf6a') || podium.includes('242, 207, 106'), podium.slice(0, 60));

  // 路牌段位名：王者 / 星耀 / 未定级
  const body = await page.textContent('body');
  for (const t of ['王者', '星耀', '未定级']) {
    check(`段位路牌「${t}」`, body?.includes(t) ?? false);
  }

  // 精灵图已更新：披风金边/腰带金应体现在清单 pipeline 版本
  const manifest = await (await fetch(BASE + '/sprites/manifest.json')).json();
  check('精灵管线版本 3.x', String(manifest.pipeline).startsWith('3.'), manifest.pipeline);

  // 详情页「她的营地」与武器渲染
  await page.goto(BASE + '/model/anthropic-claude-fable-5-1/', { waitUntil: 'networkidle' });
  const detail = await page.textContent('main');
  check('详情页「她的营地」', detail?.includes('她的营地') ?? false);
  check('详情页有精灵图', (await page.$$eval('div[style*="sprites"]', (els) => els.length)) > 0);

  await browser.close();
  if (fail.length) {
    console.error(`\n${fail.length} failed: ${fail.join(', ')}`);
    process.exit(1);
  }
  console.log('\nall theme checks passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
