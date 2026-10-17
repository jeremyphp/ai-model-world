/**
 * 诊断工具：把一张精灵图按色相印成字符画，给「这台机器不能看图」的场景做视觉自查。
 * 用法：npx tsx scripts/qa/sprite-ascii.ts <designKey> [region <x0> <y0> <x1> <y1>]
 * 图例：G=金 w=钢/白 S=皮肤 H=发/衣 C=浅灰 #=深线 .=半透明（光环）。
 */
import { DESIGNS, designFor, gearFor } from '../sprites/chibi/designs.ts';
import { renderFrame, type ChibiFlags } from '../sprites/chibi/render.ts';

const key = process.argv[2] ?? 'anthropic';
const isRegion = process.argv[3] === 'region';
const x0 = isRegion ? Number(process.argv[4] ?? 0) : 0;
const y0 = isRegion ? Number(process.argv[5] ?? 0) : 0;
const x1 = isRegion ? Number(process.argv[6] ?? 63) : 63;
const y1 = isRegion ? Number(process.argv[7] ?? 63) : 63;

const flags: ChibiFlags = { imageIn: true, audio: false, imageOut: false, openWeights: false };
const design =
  DESIGNS[key] ??
  designFor({ id: key, name: key, nameZh: key, accentColor: '#888888' }, { id: 'x', name: 'x', imageOut: false });
const vendor = { id: design.key.split('/')[0], name: design.key, nameZh: design.name, accentColor: '#888888' };
const geared = gearFor(design, vendor);
const { raster } = renderFrame(geared, flags);
console.log(`## ${geared.name} weapon=${geared.weapon} side=${geared.weaponSide ?? '-'}`);

function classify(r: number, g: number, b: number): string {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const v = max / 255;
  if (v > 0.92 && max - min < 40) return 'w';
  if (v < 0.2) return '#';
  const s = max === 0 ? 0 : (max - min) / max;
  if (s < 0.12) return v > 0.85 ? 'C' : 'S';
  let h = 0;
  if (max === r) h = ((g - b) / (max - min) + 6) % 6;
  else if (max === g) h = (b - r) / (max - min) + 2;
  else h = (r - g) / (max - min) + 4;
  h *= 60;
  if (h >= 32 && h <= 62 && v > 0.5) return 'G';
  if (v > 0.7 && s < 0.35) return 'C';
  return 'H';
}

const tens = '          1         2         3         4         5         6';
let ruler = '    ';
for (let x = x0; x <= x1; x++) ruler += String(x % 10);
console.log(tens.slice(0, 4 + (x1 - x0 + 1)));
console.log(ruler);
for (let y = y0; y <= y1; y++) {
  let line = String(y).padStart(3) + ' ';
  for (let x = x0; x <= x1; x++) {
    const i = (y * 64 + x) * 4;
    const a = raster.data[i + 3];
    if (a < 16) line += ' ';
    else if (a < 120) line += '.';
    else line += classify(raster.data[i], raster.data[i + 1], raster.data[i + 2]);
  }
  console.log(line);
}
