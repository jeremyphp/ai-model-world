/**
 * Colour ramps for the hand-drawn chibi sprites.
 *
 * Every material (hair, skin, cloth…) is a five-step ramp:
 *   0 line · 1 shadow · 2 base · 3 light · 4 highlight
 * Designs may spell a ramp out by hand; otherwise it is derived from one base
 * colour with hue-shifted shading (shadows lean cool, lights lean warm), which is
 * what keeps a derived ramp from looking like a flat brightness slider.
 */

import type { Rgba } from '../raster.ts';

export type Ramp = readonly [Rgba, Rgba, Rgba, Rgba, Rgba];

export function hex(value: string, alpha = 255): Rgba {
  const v = value.replace('#', '');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16), alpha];
}

function toHsl([r, g, b]: Rgba): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
}

function fromHsl(h: number, s: number, l: number, a = 255): Rgba {
  const hh = (((h % 360) + 360) % 360) / 360;
  const f = (n: number) => {
    const k = (n + hh * 12) % 12;
    const c = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - c * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4), a];
}

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/** Move a hue a little towards a target hue, the short way round. */
function lean(h: number, target: number, amount: number): number {
  const d = ((target - h + 540) % 360) - 180;
  return h + d * amount;
}

/** Derive a five-step ramp from one base colour. */
export function ramp(base: string): Ramp {
  const rgb = hex(base);
  const [h, s, l] = toHsl(rgb);
  const grey = s < 0.08;
  const cool = (k: number) => (grey ? h : lean(h, 255, k));
  const warm = grey ? h : lean(h, 55, 0.06);
  return [
    fromHsl(cool(0.16), clamp(s * 0.55 + 0.1), clamp(l * 0.3)),
    fromHsl(cool(0.08), clamp(s * 0.95), clamp(l - 0.12 - l * 0.06)),
    rgb,
    fromHsl(warm, clamp(s * 0.95), clamp(l + (1 - l) * 0.35)),
    fromHsl(warm, clamp(s * 0.7), clamp(l + (1 - l) * 0.7)),
  ];
}

/** A ramp given explicitly as five hex colours (line → highlight). */
export function rampOf(line: string, shadow: string, base: string, light: string, highlight: string): Ramp {
  return [hex(line), hex(shadow), hex(base), hex(light), hex(highlight)];
}

/**
 * 王者荣耀英雄风的金色。与前端皇冠、名牌金色同族（base #f5d76e），
 * 铠甲包边、腰带、武器配件的金属件全用它，保证全站的金是同一块金。
 */
export const GOLD: Ramp = rampOf('#6b4d12', '#8a6415', '#f5d76e', '#ffe9a6', '#fff6d9');

export function mix(a: Rgba, b: Rgba, t: number): Rgba {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
    Math.round(a[3] + (b[3] - a[3]) * t),
  ];
}

export function mixRamp(a: Ramp, b: Ramp, t: number): Ramp {
  return [0, 1, 2, 3, 4].map((i) => mix(a[i], b[i], t)) as unknown as Ramp;
}
