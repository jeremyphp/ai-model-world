/**
 * Hero weapons — one per vendor, the way every 王者荣耀 hero carries one.
 *
 * Every weapon is drawn in the same palette language as the rest of the cast:
 * `weapon` material for the blade/haft (steel by default, overridable per
 * design, e.g. NVIDIA's green energy blade), `gold` for the fittings, and the
 * design's `accent` for gems. Right-hand weapons grip at x41–43 / y43–45 where
 * the hand is; left-hand weapons (shield, book) sit over the left arm.
 *
 * Art is hand-authored pixel rows, same discipline as body.ts: slots, never
 * colours, so one drawing serves every vendor's palette.
 */

import type { Layer } from './grid.ts';

export type WeaponId =
  | 'sword'
  | 'staff'
  | 'spear'
  | 'bow'
  | 'fan'
  | 'gun'
  | 'trident'
  | 'hammer'
  | 'dagger'
  | 'shield'
  | 'book'
  | 'mic'
  | 'blade';

/** Weapons carried in the left hand; they coexist with the paintbrush. */
export const LEFT_HAND_WEAPONS: readonly WeaponId[] = ['shield', 'book'];

function l(x: number, y: number, rows: readonly string[]): Layer {
  return { x, y, rows, mats: ['weapon', 'gold', 'accent'] };
}

/** Mirror a layer about the sprite's vertical centre (for left-hand grips). */
function mirror(layer: Layer): Layer {
  const w = Math.max(...layer.rows.map((r) => r.length));
  return { ...layer, x: 63 - (layer.x + w), flip: !(layer.flip ?? false) };
}

/** Diagonal blade raised beside the head, gold crossguard, grip in the hand. */
const SWORD: Layer = l(40, 22, [
  '..................hm',
  '.................hm.',
  '................hm..',
  '...............hm...',
  '..............hm....',
  '.............hm.....',
  '............hm......',
  '...........hm.......',
  '..........hm........',
  '.........hm.........',
  '........hm..........',
  '.......hm...........',
  '......hm............',
  '.....hm.............',
  '....hm..............',
  '...hm...............',
  '..hm................',
  '.hm.................',
  'hm..................',
  '..MMMMMMMM..........',
  '..mm................',
  '..mm................',
  '..mm................',
  '..MM................',
]);

/** Staff with a glowing gem orb; the pole passes through the right hand. */
const STAFF: Layer = l(41, 5, [
  '..mmmm....',
  '.mMMMMm...',
  '.M2222M...',
  '.M2222M...',
  '.mMMMMm...',
  '..mmmm....',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.MMMM.....',
]);

/** Long spear, blade tip up, gold collar under the blade. */
const SPEAR: Layer = l(41, 3, [
  '.m........',
  '.mm.......',
  'mmmm......',
  'mhmm......',
  'mhmm......',
  '.mMm......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.MMMM.....',
]);

/** Vertical bow held in the left hand, gold nocks, string against the palm. */
const BOW: Layer = l(10, 16, [
  '..MM........M.',
  '..mm........m.',
  '..mm........m.',
  '..mm........m.',
  '..mm........m.',
  '..mm........m.',
  '..mm........m.',
  '..mm........m.',
  '..mm........m.',
  '..mm........m.',
  '..mm........m.',
  '..mm........m.',
  '..mm........m.',
  '..mm........m.',
  '..mm........m.',
  '..mm........m.',
  '..mm........m.',
  '..mm........m.',
  '..mm........m.',
  '..mm........m.',
  '..mm........m.',
  '..mm........m.',
  '..mm........m.',
  '..mm........m.',
  '..mm........m.',
  '..mm........m.',
  '..mm........m.',
  '..mm........m.',
  '..mm........m.',
  '..mm........m.',
  '..mm........m.',
  '..mm........m.',
  '..MM........M.',
]);

/** Open fan spreading from the right hand, ribs + gold rim, generated rows. */
function fanLayer(): Layer {
  const px = 41;
  const py = 45;
  const R = 17;
  const rows: string[] = [];
  for (let y = 27; y <= 45; y++) {
    let row = '';
    for (let x = 39; x <= 59; x++) {
      const dx = x - px;
      const dy = py - y;
      const dist = Math.hypot(dx, dy);
      const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (dist > R || deg < 12 || deg > 90) {
        row += '.';
        continue;
      }
      const onRib = Math.abs(deg - Math.round(deg / 9) * 9) < 2.6;
      row += dist >= R - 1.5 ? 'M' : onRib ? 'm' : '.';
    }
    rows.push(row);
  }
  return { x: 39, y: 27, rows, mats: ['weapon', 'gold', 'accent'] };
}

/** Pistol pointing right, gold muzzle, grip in the right hand. */
const GUN: Layer = l(39, 38, [
  '...mmmmmmm..',
  '..mmmmmmmmM.',
  '..mmmmmmmm..',
  '..mmmmmmm...',
  '..mmmmmm....',
  '..mmmmm.....',
  '...mmmm.....',
  '...mmm......',
]);

/** Trident: three prongs over a gold crossbar, pole through the right hand. */
const TRIDENT: Layer = l(39, 6, [
  '..m..m..m...',
  '..m..m..m...',
  '.mm.mm.mm...',
  '.MM.MM.MM...',
  '.MMMMMMMM...',
  '..mm........',
  '..mm........',
  '..mm........',
  '..mm........',
  '..mm........',
  '..mm........',
  '..mm........',
  '..mm........',
  '..mm........',
  '..mm........',
  '..mm........',
  '..mm........',
  '..mm........',
  '..mm........',
  '..mm........',
  '..mm........',
  '..mm........',
  '..mm........',
  '..mm........',
  '..mm........',
  '..mm........',
  '..mm........',
  '..mm........',
  '..mm........',
  '..mm........',
  '..mm........',
  '..mm........',
  '..mm........',
  '..mm........',
  '..mm........',
  '..mm........',
  '..mm........',
  '..mm........',
  '.MMMM.......',
]);

/** War hammer: heavy head with a gold band, handle through the right hand. */
const HAMMER: Layer = l(38, 20, [
  '....mmmmmmmmmm.',
  '....mMMMMMMMMm.',
  '....mmmmmmmmmm.',
  '....mmmmmmmmmm.',
  '.....mmmmmmmm..',
  '.....mmmmmmmm..',
  '..mm.mmmmmmmm..',
  '..mm............',
  '..mm............',
  '..mm............',
  '..mm............',
  '..mm............',
  '..mm............',
  '..mm............',
  '..mm............',
  '..mm............',
  '..mm............',
  '..mm............',
  '..mm............',
  '..mm............',
  '..mm............',
  '..mm............',
  '..mm............',
  '..mm............',
  '..mm............',
  '..MM............',
]);

/** Short dagger: small blade, gold guard, for the quick and the quiet. */
const DAGGER: Layer = l(41, 32, [
  '.mm.......',
  '.mm.......',
  '.hm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.MMMM.....',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.MM.......',
]);

/** Kite shield over the left arm, gold corner fittings. */
const SHIELD: Layer = l(12, 34, [
  '..mmmmmmmmmm..',
  '.mmmmmmmmmmmm.',
  '.mMmmmmmmmmMm.',
  '.mmmmmmmmmmmm.',
  '.mmmmmmmmmmmm.',
  '.mMmmmmmmmmMm.',
  '.mmmmmmmmmmmm.',
  '..mmmmmmmmmm..',
  '..mmmmmmmmmm..',
  '...mmmmmmmm...',
  '...mmmmmmmm...',
  '....mmmmmm....',
]);

/** Tome held against the chest, gold clasps. */
const BOOK: Layer = l(14, 34, [
  '...mmmmmmmmmm...',
  '..mmmmmmmmmmmm..',
  '..mMmmmmmmmmMm..',
  '..mmmmmmmmmmmm..',
  '..mmmmmmmmmmmm..',
  '..mMmmmmmmmmMm..',
  '..mmmmmmmmmmmm..',
  '...mmmmmmmmmm...',
  '...mmmmmmmmmm...',
]);

/** Microphone on a pole for the voice-first vendor. */
const MIC: Layer = l(41, 30, [
  '..mmmm....',
  '.mMMMMm...',
  '.MmmmmM...',
  '.MmmmmM...',
  '..MMMM....',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.mm.......',
  '.MMMM.....',
]);

export function weaponLayers(id: WeaponId, left = false): Layer[] {
  const layers = (() => {
    switch (id) {
      case 'sword':
      case 'blade':
        return [SWORD];
      case 'staff':
        return [STAFF];
      case 'spear':
        return [SPEAR];
      case 'bow':
        return [BOW];
      case 'fan':
        return [fanLayer()];
      case 'gun':
        return [GUN];
      case 'trident':
        return [TRIDENT];
      case 'hammer':
        return [HAMMER];
      case 'dagger':
        return [DAGGER];
      case 'shield':
        return [SHIELD];
      case 'book':
        return [BOOK];
      case 'mic':
        return [MIC];
    }
  })();
  return left ? layers.map(mirror) : layers;
}
