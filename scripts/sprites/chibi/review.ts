/**
 * Human review sheet for the chibi cast.
 *
 *   npx tsx scripts/sprites/chibi/review.ts
 *
 * Writes docs/samples/chibi/*.png (4× upscales) plus index.html, and a single
 * screenshot docs/samples/chibi-review.png. Nothing here feeds the site.
 */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { chromium } from 'playwright';

import { signsOf } from '../../../src/lib/derive.ts';
import type { ModelRecord, WorldSnapshot } from '../../../src/lib/types.ts';
import type { Raster } from '../raster.ts';
import { DESIGNS, designFor, fallbackDesign, gearFor, type Design } from './designs.ts';
import { type ChibiFlags, renderFrame } from './render.ts';

const ROOT = path.resolve(__dirname, '../../..');
const OUT = path.join(ROOT, 'docs/samples/chibi');
const SCALE = 4;

async function png(r: Raster, scale = SCALE): Promise<Buffer> {
  return sharp(r.data, { raw: { width: r.width, height: r.height, channels: 4 } })
    .resize(r.width * scale, r.height * scale, { kernel: 'nearest' })
    .png()
    .toBuffer();
}

function flagsOf(m: ModelRecord): ChibiFlags {
  const s = signsOf(m);
  return { imageIn: s.eyewear === 'glasses', audio: s.headphones, imageOut: s.paintbrush, openWeights: s.key };
}

const BASIS: Record<Design['basis'], string> = {
  community: '社区娘化',
  official: '官方形象',
  icon: '按图标设计',
  fallback: '兜底（未收录）',
};

async function main() {
  const snap = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/models.json'), 'utf8')) as WorldSnapshot;
  const vendors = new Map(snap.vendors.map((v) => [v.id, v]));
  const live = snap.models.filter((m) => !m.retiredAt);
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  // One representative model per design: the best-scored live model that maps to it.
  const rep = new Map<string, ModelRecord>();
  const count = new Map<string, number>();
  for (const m of live.sort((a, b) => (b.benchmarks.eci ?? 0) - (a.benchmarks.eci ?? 0))) {
    const v = vendors.get(m.vendorId);
    if (!v) continue;
    const d = designFor(v, { id: m.id, name: m.name, imageOut: signsOf(m).paintbrush });
    count.set(d.key, (count.get(d.key) ?? 0) + 1);
    if (!rep.has(d.key)) rep.set(d.key, m);
  }

  const cards: string[] = [];
  const BASE: ChibiFlags = { imageIn: true, audio: false, imageOut: false, openWeights: false };
  const addCard = async (d: Design, m: ModelRecord | undefined) => {
    const vendorId = d.key.split('/')[0];
    const geared = gearFor(d, { id: vendorId, name: vendorId, nameZh: d.name, accentColor: '#888888' });
    const file = `${d.key.replace('/', '--')}.png`;
    fs.writeFileSync(path.join(OUT, file), await png(renderFrame(geared, BASE).raster));
    const n = count.get(d.key) ?? 0;
    cards.push(`<figure class="card ${d.basis}">
  <img src="chibi/${file}" alt="${d.name}">
  <figcaption>
    <b>${d.name}</b><span class="tag">${BASIS[d.basis]}</span>
    <p>${d.note}</p>
    <small>武器：${geared.weapon ?? '-'} · ${m ? `示例：${m.name}` : '站内暂无模型'} · 覆盖 ${n} 个模型</small>
  </figcaption>
</figure>`);
  };

  const order = Object.values(DESIGNS);
  for (const d of order) await addCard(d, rep.get(d.key));

  // Fallback examples: the largest vendors that have no dedicated entry.
  const fallbacks = [...count.entries()]
    .filter(([k]) => !DESIGNS[k] && vendors.has(k))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  for (const [k] of fallbacks) await addCard(fallbackDesign(vendors.get(k)!), rep.get(k));

  // Capability props on one character: what stays per-model.
  const demo = gearFor(DESIGNS.anthropic, { id: 'anthropic', name: 'anthropic', nameZh: 'Claude 娘', accentColor: '#888888' });
  const props: [string, ChibiFlags][] = [
    ['纯文本（闭眼）', { imageIn: false, audio: false, imageOut: false, openWeights: false }],
    ['能看图（睁眼）', { imageIn: true, audio: false, imageOut: false, openWeights: false }],
    ['能听会说（耳机）', { imageIn: true, audio: true, imageOut: false, openWeights: false }],
    ['会画图（画笔）', { imageIn: true, audio: false, imageOut: true, openWeights: false }],
    ['开源权重（钥匙）', { imageIn: true, audio: false, imageOut: false, openWeights: true }],
    ['全部', { imageIn: true, audio: true, imageOut: true, openWeights: true }],
  ];
  const propCards: string[] = [];
  for (const [label, f] of props) {
    const file = `props-${propCards.length}.png`;
    fs.writeFileSync(path.join(OUT, file), await png(renderFrame(demo, f).raster, 3));
    propCards.push(`<figure class="prop"><img src="chibi/${file}" alt="${label}"><figcaption>${label}</figcaption></figure>`);
  }

  // What a handful of well-known models actually look like on the site.
  const showcase = ['deepseek', 'zhipuai', 'openai', 'anthropic', 'google', 'moonshotai', 'alibaba', 'bytedance-seed']
    .map((k) => rep.get(k))
    .filter((m): m is ModelRecord => Boolean(m));
  const liveCards: string[] = [];
  for (const m of showcase) {
    const v = vendors.get(m.vendorId)!;
    const d = designFor(v, { id: m.id, name: m.name, imageOut: signsOf(m).paintbrush });
    const f = flagsOf(m);
    const file = `live-${liveCards.length}.png`;
    fs.writeFileSync(path.join(OUT, file), await png(renderFrame(d, f).raster, 3));
    const tags = [f.imageIn ? '能看图' : '纯文本', f.audio && '能听', f.imageOut && '会画', f.openWeights && '开源'].filter(Boolean).join(' · ');
    liveCards.push(`<figure class="prop"><img src="chibi/${file}" alt="${m.name}"><figcaption>${m.name}<br><small>${tags}</small></figcaption></figure>`);
  }

  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>像素娘化形象 · 校验稿</title>
<style>
body{margin:0;background:#1d2230;color:#e8e4d8;font:14px/1.5 -apple-system,"PingFang SC",sans-serif;padding:28px}
h1{font-size:22px;margin:0 0 4px;color:#f5d76e} h2{font-size:17px;margin:28px 0 12px;color:#f5d76e}
.lead{color:#aab0c0;margin:0 0 18px}
.grid{display:grid;grid-template-columns:repeat(6,1fr);gap:14px}
.card{margin:0;background:#2a3142;border:2px solid #3a4358;padding:10px}
.card img{display:block;width:100%;image-rendering:pixelated;background:#353d52}
.card b{font-size:15px}.tag{margin-left:6px;font-size:12px;padding:0 5px;border:1px solid #6a7390;color:#c8cde0}
.community .tag{border-color:#f5d76e;color:#f5d76e}.official .tag{border-color:#7fd6a0;color:#7fd6a0}
.fallback{opacity:.9;border-style:dashed}
.card p{margin:4px 0;font-size:12.5px;color:#c9cdd9}.card small{color:#8d93a6;font-size:12px}
.props{display:flex;flex-wrap:wrap;gap:14px}.prop{margin:0;text-align:center;background:#2a3142;padding:8px;border:2px solid #3a4358}
.prop img{display:block;image-rendering:pixelated;background:#353d52}.prop figcaption{font-size:13px;margin-top:4px}
</style></head><body>
<h1>像素娘化形象 · 校验稿</h1>
<p class="lead">每家厂商一个固定形象，同一家的所有模型共用；只有下面第二节这些「能力小物件」按模型数据变化。</p>
<h2>厂商形象</h2><div class="grid">${cards.join('\n')}</div>
<h2>按模型数据变化的部分（以 Claude 娘为例）</h2><div class="props">${propCards.join('\n')}</div>
<h2>站内实际样子（各家当前代表模型）</h2><div class="props">${liveCards.join('\n')}</div>
</body></html>`;
  fs.writeFileSync(path.join(ROOT, 'docs/samples/chibi-review.html'), html);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(`file://${path.join(ROOT, 'docs/samples/chibi-review.html')}`);
  await page.screenshot({ path: path.join(ROOT, 'docs/samples/chibi-review.png'), fullPage: true });
  await browser.close();
  console.log(`[review] ${cards.length} designs, ${propCards.length} prop demos -> docs/samples/chibi-review.{html,png}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
