/**
 * `Design` + capability flags → a 576 × 320 sheet in the manifest's layout.
 *
 * The sheet keeps the old 9 × 5 grid so the site needs no changes: row 0 is the
 * standing pose, rows 1–4 are a nine-frame loop (a small bob with a blink). The
 * characters are front-facing only, so all four "walk" rows carry the same loop.
 */

import type { SpriteAnchors } from '../../../src/lib/sprite/types.ts';
import { blank, blit, bounds, type Box, type Raster } from '../raster.ts';
import { arms, aura, belt, cape, face, head, legs, neck, outfit, pauldrons, type EyeState, type OutfitStyle } from './body.ts';
import { GOLD, ramp } from './color.ts';
import type { Design, Paint } from './designs.ts';
import { ears, extra, headphones, key, letterBadge, ornament, paintbrush, tail } from './extras.ts';
import { drawLayer, type Layer, type Material, type Palette } from './grid.ts';
import { backHair, frontHair } from './hair.ts';
import { GLYPHS } from '../font.ts';
import { weaponLayers, LEFT_HAND_WEAPONS } from './weapons.ts';

export const CELL = 64;
export const COLUMNS = 9;
export const ROWS = 5;
export const OUT_W = CELL * COLUMNS;
export const OUT_H = CELL * ROWS;
export const OUT_ROW = { stand: 0, up: 1, left: 2, down: 3, right: 4 } as const;

/** Per-model signs that stay data-driven on top of the vendor's fixed character. */
export interface ChibiFlags {
  /** Reads images: eyes open. Text-only models keep them closed, like the community's blindfolded whale girl. */
  imageIn: boolean;
  audio: boolean;
  imageOut: boolean;
  openWeights: boolean;
}

function material(p: Paint): Material {
  if (typeof p === 'string') return ramp(p);
  return { stops: p.map(([y, c]) => [y, ramp(c)] as const) };
}

const SKIN = '#ffe3d3';

function paletteOf(d: Design): Palette {
  const pal: Palette = {
    skin: ramp(d.skin ?? SKIN),
    hair: material(d.hair),
    eye: ramp(d.eye),
    cloth: ramp(d.cloth),
    skirt: material(d.skirt ?? d.cloth),
    blouse: ramp(d.blouse ?? '#fbf8f4'),
    accent: ramp(d.accent ?? d.cloth),
    legs: ramp(d.legs ?? d.skin ?? SKIN),
    shoe: ramp(d.shoe ?? '#5e3a2c'),
    phones: ramp('#3a3d4a'),
    phonesAccent: ramp(d.accent ?? d.cloth),
    brush: ramp('#b07a4a'),
    brushTip: ramp('#e8506a'),
    key: ramp('#f2c14e'),
    // 王者荣耀英雄风的铠甲金与武器钢
    gold: GOLD,
    weapon: ramp(d.weaponColor ?? '#c9cdd4'),
  };
  if (d.logo) for (const [k, v] of Object.entries(d.logo.colors)) pal[k] = material(v);
  if (d.letter) {
    pal.badge = ramp(d.letter.badge);
    pal.logo = ramp(d.letter.ink);
  }
  if (d.ears) {
    pal.ear = ramp(d.ears.color);
    pal.earInner = ramp(d.ears.inner);
  }
  if (d.tail) {
    pal.tail = ramp(d.tail.color);
    pal.tailTip = ramp(d.tail.tip);
  }
  for (const e of d.extras ?? []) for (const [k, v] of Object.entries(e.colors)) pal[k] = ramp(v);
  return pal;
}

/** Which material the sleeves are cut from: the jacket's own cloth, or the blouse under a bodice. */
const SLEEVE_MAT: Record<OutfitStyle, string> = {
  frill: 'blouse',
  sailor: 'blouse',
  maid: 'blouse',
  gothic: 'blouse',
  hanfu: 'blouse',
  coat: 'blouse',
  shirt: 'cloth',
  jacket: 'cloth',
  hoodie: 'cloth',
};

interface Built {
  layers: Layer[];
  /** Indices into `layers` that make up the head cluster, for anchors. */
  headIdx: Set<number>;
  skullIdx: number;
  palette: Palette;
}

function build(d: Design, flags: ChibiFlags, eyes: EyeState): Built {
  const layers: Layer[] = [];
  const headIdx = new Set<number>();
  const push = (l: Layer | Layer[], isHead = false) => {
    for (const x of Array.isArray(l) ? l : [l]) {
      if (x.rows.length === 0) continue;
      if (isHead) headIdx.add(layers.length);
      layers.push(x);
    }
  };
  const extras = new Set((d.extras ?? []).map((e) => e.kind));

  // 王者荣耀英雄风的底层：光环 → 披风 → 尾巴（尾巴压在披风上）→ 后发
  push(aura());
  push(cape());
  if (d.tail) push(tail(d.tail.style));
  push(backHair(d.hairStyle), true);
  if (d.ears) push(ears(d.ears.style), true);
  push(legs(d.boots ? 'boot' : 'shoe'));
  push(neck);
  push(outfit(d.outfit));
  push(belt());
  if (extras.has('scarf')) push(extra('scarf'));
  push(arms(d.sleeves ?? 'long', SLEEVE_MAT[d.outfit]));
  push(pauldrons());
  if (flags.imageOut) push(paintbrush);
  const skullIdx = layers.length;
  push(head, true);
  push(face(eyes));
  if (extras.has('glasses')) push(extra('glasses'));
  push(frontHair(d.hairStyle), true);
  if (flags.audio) push(headphones, true);
  for (const kind of ['sleepmask', 'shades', 'beret', 'antenna', 'bells'] as const) {
    if (extras.has(kind)) push(extra(kind), true);
  }
  if (d.logo) push(ornament(d.logo.id, d.logo.side), true);
  if (d.letter) push(letterBadge(d.letter.side, GLYPHS[d.letter.char] ?? GLYPHS['?']), true);
  // 武器画在身体与头饰之后：拿在手上的东西要在最前面。
  // 会出图的模型右手换成画笔——画笔就是画师的武器；盾与法典在左手，仍可共存。
  const wield = d.weapon ?? 'sword';
  const leftHand = LEFT_HAND_WEAPONS.includes(wield);
  if (!flags.imageOut || leftHand) push(weaponLayers(wield, d.weaponSide === 'left' && !leftHand));
  // 钥匙最后画：左手持武时它挂在武器前而不是被杆子盖住
  if (flags.openWeights) push(key);
  return { layers, headIdx, skullIdx, palette: paletteOf(d) };
}

function toBox(box: Box | null): SpriteAnchors['head'] {
  if (!box) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: box.x0, y: box.y0, width: box.x1 - box.x0 + 1, height: box.y1 - box.y0 + 1 };
}

export interface Frame {
  raster: Raster;
  anchors: SpriteAnchors;
}

export function renderFrame(d: Design, flags: ChibiFlags, eyes: EyeState = flags.imageIn ? 'open' : 'closed'): Frame {
  const { layers, headIdx, skullIdx, palette } = build(d, flags, eyes);
  const raster = blank(CELL, CELL);
  const headOnly = blank(CELL, CELL);
  const skull = blank(CELL, CELL);
  layers.forEach((l, i) => {
    drawLayer(raster, l, palette);
    if (headIdx.has(i)) drawLayer(headOnly, l, palette);
    if (i === skullIdx) drawLayer(skull, l, palette);
  });
  // The crown sits on the hair, not on the scalp: take the skull's width but the
  // top of the head cluster's hair cap, skipping ears and antennae above it.
  const headBox = bounds(headOnly, 0, 0, CELL, CELL);
  const skullBox = bounds(skull, 0, 0, CELL, CELL);
  const crownTop = firstHairRow(raster);
  return {
    raster,
    anchors: {
      head: toBox(headBox),
      skull: skullBox ? { ...toBox(skullBox), y: crownTop, height: skullBox.y1 - crownTop + 1 } : toBox(null),
      body: toBox(bounds(raster, 0, 0, CELL, CELL)),
    },
  };
}

/** First row where the head is at least 10 px wide — the top of the hair cap. */
function firstHairRow(r: Raster): number {
  for (let y = 0; y < CELL; y++) {
    let run = 0;
    for (let x = 0; x < CELL; x++) if (r.data[(y * CELL + x) * 4 + 3] > 0) run++;
    if (run >= 10) return y;
  }
  return 0;
}

/** Vertical offset for each of the nine loop frames: a gentle two-pixel bob. */
const BOB = [0, 0, 1, 1, 1, 0, 0, 0, 0];
const BLINK_FRAME = 6;

export function renderSheet(d: Design, flags: ChibiFlags): { sheet: Raster; anchors: SpriteAnchors } {
  const main = renderFrame(d, flags);
  const blink = flags.imageIn ? renderFrame(d, flags, 'closed').raster : main.raster;
  const sheet = blank(OUT_W, OUT_H);
  blit(sheet, main.raster, 0, 0, CELL, CELL, 0, 0);
  for (let row = 1; row < ROWS; row++) {
    for (let col = 0; col < COLUMNS; col++) {
      const src = col === BLINK_FRAME ? blink : main.raster;
      const dy = BOB[col];
      blit(sheet, src, 0, 0, CELL, CELL - dy, col * CELL, row * CELL + dy);
    }
  }
  return { sheet, anchors: main.anchors };
}
