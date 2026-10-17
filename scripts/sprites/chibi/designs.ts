/**
 * Who each vendor *is*, as a chibi.
 *
 * Like `src/data/vendor-registry.ts`, this is a lookup table of human common
 * sense, not logic: a machine can read DeepSeek's price, not that DeepSeek is a
 * silver-haired girl with a whale in her hair. Priority when designing an entry:
 *
 *   1. an established moe-anthropomorphised character the community already
 *      recognises (DeepSeek's whale girl, the linux.do "AI娘" cast, Grok's Ani,
 *      Doubao's own 3D mascot, Z.ai's black fox);
 *   2. otherwise the vendor's logo and brand colour, worn as a hair ornament
 *      and outfit, plus one memorable motif (Meta's llama ears, Tencent's
 *      penguin scarf, Baidu's bear paw).
 *
 * A vendor missing from the table still gets a fixed look: brand-colour hair
 * and a badge with its initial. Nothing here is random — every model of a
 * vendor wears the same character, and the only per-model differences are the
 * capability props that come from data (eyes, headphones, brush, key).
 */

import { hashInt } from '../hash.ts';
import type { OutfitStyle, SleeveStyle } from './body.ts';
import type { EarStyle, Extra, LogoId, OrnamentSide, TailStyle } from './extras.ts';
import type { HairOptions } from './hair.ts';
import type { WeaponId } from './weapons.ts';

/** A flat colour, or a vertical gradient as [canvas y, colour] stops. */
export type Paint = string | readonly (readonly [number, string])[];

export interface Design {
  /** Stable key: the vendor id, or `vendor/variant`. */
  key: string;
  /** Display name for the review sheet, e.g. 「GPT 酱」. */
  name: string;
  /** What the look is based on — shown on the review sheet. */
  basis: 'community' | 'official' | 'icon' | 'fallback';
  /** One line on where the look comes from, for human review. */
  note: string;
  hair: Paint;
  hairStyle: HairOptions;
  eye: string;
  skin?: string;
  outfit: OutfitStyle;
  sleeves?: SleeveStyle;
  cloth: string;
  skirt?: Paint;
  blouse?: string;
  accent?: string;
  legs?: string;
  shoe?: string;
  boots?: boolean;
  /** 王者荣耀英雄风的武器。未指定时按 WEAPONS 表 / 哈希兜底。 */
  weapon?: WeaponId;
  /** 武器主体色，默认钢色。NVIDIA 用荧光绿光刃。 */
  weaponColor?: string;
  /** 左手持武：尾巴占右侧的设定（DeepSeek 鲸尾、智谱狐尾）用左手。 */
  weaponSide?: 'left' | 'right';
  logo?: { id: LogoId; side: OrnamentSide; colors: Record<string, Paint> };
  letter?: { char: string; side: OrnamentSide; badge: string; ink: string };
  ears?: { style: EarStyle; color: string; inner: string };
  tail?: { style: TailStyle; color: string; tip: string };
  extras?: { kind: Extra; colors: Record<string, string> }[];
}

/**
 * 武器分配：每位英雄一把看家武器。
 * 右撇子武器（剑/法杖/枪……）拿在右手；盾、法典拿在左手，与画笔共存。
 * 表里没有的走哈希兜底，未收录厂商也永远有武器。
 */
const WEAPONS: Record<string, WeaponId> = {
  openai: 'staff',
  'openai/image': 'staff',
  anthropic: 'sword',
  google: 'staff',
  'google/gemma': 'staff',
  deepseek: 'trident',
  zhipuai: 'fan',
  'bytedance-seed': 'spear',
  alibaba: 'sword',
  moonshotai: 'bow',
  xai: 'gun',
  meta: 'hammer',
  mistral: 'sword',
  nvidia: 'blade',
  cohere: 'book',
  microsoft: 'shield',
  amazon: 'bow',
  tencent: 'spear',
  minimax: 'mic',
  xiaomi: 'gun',
  inclusionai: 'staff',
  sakana: 'trident',
  perplexity: 'book',
  ibm: 'shield',
  stepfun: 'spear',
  baidu: 'hammer',
  meituan: 'dagger',
  upstage: 'staff',
};

/** 武器主体色覆盖：默认钢色，光刃类给荧光。 */
const WEAPON_COLORS: Record<string, string> = {
  nvidia: '#7dff9e',
};

/** 左手持武的设定：尾巴从右侧升起，右手边留给尾巴。 */
const WEAPON_SIDES: Record<string, 'left'> = {
  deepseek: 'left',
  zhipuai: 'left',
};

const FALLBACK_WEAPONS: readonly WeaponId[] = ['sword', 'staff', 'spear', 'bow', 'fan', 'gun', 'trident', 'hammer', 'dagger', 'shield', 'book', 'mic', 'blade'];

/** 给一个设定补上武器与武器色。设定自带武器优先。 */
export function gearFor(d: Design, vendor: VendorLike): Design {
  const key = d.key;
  const weapon =
    d.weapon ??
    WEAPONS[key] ??
    WEAPONS[vendor.id] ??
    FALLBACK_WEAPONS[hashInt(`chibi:${vendor.id}`, 'weapon', FALLBACK_WEAPONS.length)];
  const weaponColor = d.weaponColor ?? WEAPON_COLORS[key] ?? WEAPON_COLORS[vendor.id];
  const weaponSide = d.weaponSide ?? WEAPON_SIDES[key] ?? WEAPON_SIDES[vendor.id];
  return { ...d, weapon, weaponColor, weaponSide };
}

const RAINBOW: Paint = [
  [5, '#f26b5b'],
  [14, '#f7a24a'],
  [24, '#f5d25a'],
  [34, '#6cc983'],
  [46, '#4f8ef2'],
];

export const DESIGNS: Record<string, Design> = {
  openai: {
    key: 'openai',
    name: 'GPT 酱',
    basis: 'community',
    note: '社区「AI娘」形象：薄荷绿长卷发，头戴 OpenAI 花结发饰，白绿连衣裙',
    hair: '#9fd3b6',
    hairStyle: { back: 'wavy', fringe: 'soft', locks: 'long' },
    eye: '#2f9468',
    outfit: 'frill',
    cloth: '#4c9c78',
    skirt: '#f3f7f2',
    blouse: '#fbfdfb',
    accent: '#2e7a58',
    logo: { id: 'openai', side: 'left', colors: { badge: '#ffffff', logo: '#1f6b4c' } },
  },
  'openai/image': {
    key: 'openai/image',
    name: 'GPT Image 娘',
    basis: 'community',
    note: '社区「AI娘」漫画里的画师：黑长发、白色 OpenAI 发饰、白衬衫配黑色背带裙',
    hair: '#2c2a33',
    hairStyle: { back: 'long', fringe: 'soft', locks: 'long' },
    eye: '#5b5566',
    outfit: 'frill',
    cloth: '#26252c',
    skirt: '#26252c',
    blouse: '#fbfbfb',
    accent: '#f4f4f4',
    legs: '#f4f4f4',
    logo: { id: 'openai', side: 'left', colors: { badge: '#ffffff', logo: '#1d1d22' } },
  },
  anthropic: {
    key: 'anthropic',
    name: 'Claude 娘',
    basis: 'community',
    note: '社区「AI娘」形象：蜜桃橙长卷发，头戴 Claude 星芒发饰，白衫橙裙',
    hair: '#f3aa7c',
    hairStyle: { back: 'wavy', fringe: 'soft', locks: 'long' },
    eye: '#b3622c',
    outfit: 'frill',
    cloth: '#df8248',
    skirt: '#e58e52',
    blouse: '#fcf6ed',
    accent: '#c85f2a',
    logo: { id: 'claude', side: 'left', colors: { logo: '#d9703f', badge: '#fff1e2' } },
  },
  google: {
    key: 'google',
    name: 'Gemini 娘',
    basis: 'community',
    note: '社区「AI娘」形象：彩虹渐变长发，头戴 Gemini 四芒星，彩虹裙',
    hair: RAINBOW,
    hairStyle: { back: 'wavy', fringe: 'soft', locks: 'long' },
    eye: '#6457d6',
    outfit: 'frill',
    cloth: '#f4f3fb',
    skirt: [
      [44, '#f26b5b'],
      [46, '#f5c24a'],
      [48, '#6cc983'],
      [50, '#4f8ef2'],
    ],
    blouse: '#fbfbff',
    accent: '#4f8ef2',
    logo: { id: 'gemini', side: 'left', colors: {} },
  },
  'google/gemma': {
    key: 'google/gemma',
    name: 'Gemma 娘',
    basis: 'icon',
    note: 'Gemini 的开源妹妹：银白长发、Gemma 宝石星发饰、浅蓝裙',
    hair: '#e3e9f6',
    hairStyle: { back: 'long', fringe: 'soft', locks: 'mid' },
    eye: '#4f93dc',
    outfit: 'frill',
    cloth: '#7fb1e6',
    skirt: '#9cc4ee',
    blouse: '#ffffff',
    accent: '#3f7fd0',
    logo: { id: 'gemma', side: 'left', colors: { logo: '#3f86e8' } },
  },
  deepseek: {
    key: 'deepseek',
    name: 'DeepSeek 鲸鱼娘',
    basis: 'community',
    note: '社区鲸鱼娘：银白长发带呆毛、蓝色鲸鱼发饰、蓝白长裙、身后一条鲸尾',
    hair: '#e6e7f5',
    hairStyle: { back: 'wavy', fringe: 'soft', locks: 'long', ahoge: true },
    eye: '#3a66e0',
    outfit: 'frill',
    cloth: '#3f5fe6',
    skirt: '#eef1fc',
    blouse: '#ffffff',
    accent: '#4d6bfe',
    legs: '#ffffff',
    shoe: '#3f5fe6',
    logo: { id: 'whale', side: 'right', colors: { logo: '#4d6bfe' } },
    tail: { style: 'whale', color: '#4d6bfe', tip: '#b9c8ff' },
  },
  zhipuai: {
    key: 'zhipuai',
    name: '智谱 Z 狐娘',
    basis: 'community',
    note: '社区 Z.ai 形象：黑长直、黑狐耳与白尖狐尾、额头架着 Z 字睡眠眼罩',
    hair: '#2a2932',
    hairStyle: { back: 'hime', fringe: 'soft', locks: 'long' },
    eye: '#77689a',
    outfit: 'maid',
    cloth: '#25242b',
    skirt: '#25242b',
    blouse: '#fbf8f6',
    accent: '#1b1a20',
    legs: '#25242b',
    shoe: '#1b1a20',
    ears: { style: 'fox', color: '#2a2932', inner: '#f3eef2' },
    tail: { style: 'fox', color: '#2a2932', tip: '#f5f1f4' },
    extras: [
      { kind: 'sleepmask', colors: { mask: '#1d1c22', maskInk: '#ffffff' } },
      { kind: 'bells', colors: { bell: '#d8d8e0' } },
    ],
  },
  'bytedance-seed': {
    key: 'bytedance-seed',
    name: '豆包',
    basis: 'official',
    note: '豆包官方 3D 形象：深棕波波头侧分、蓝色小发夹、黑色短袖衬衫配黑裤',
    hair: '#3d2b25',
    hairStyle: { back: 'bob', fringe: 'swept', locks: 'short' },
    eye: '#5c3a2a',
    outfit: 'shirt',
    sleeves: 'puff',
    cloth: '#25242a',
    skirt: '#25242a',
    blouse: '#25242a',
    accent: '#3a6bff',
    shoe: '#1b1b1f',
    logo: { id: 'clip', side: 'right', colors: { logo: '#3a7bff' } },
  },
  alibaba: {
    key: 'alibaba',
    name: '千问娘',
    basis: 'icon',
    note: '按千问品牌紫设计：紫色高马尾、千问六边形徽章、紫白汉服',
    hair: '#8b79ee',
    hairStyle: { back: 'ponytail', fringe: 'soft', locks: 'mid', tieMat: 'accent' },
    eye: '#5a46d6',
    outfit: 'hanfu',
    cloth: '#6f5ce8',
    skirt: '#6f5ce8',
    blouse: '#f7f5ff',
    accent: '#f1c35f',
    logo: { id: 'qwen', side: 'left', colors: { badge: '#ffffff', logo: '#615ced' } },
  },
  moonshotai: {
    key: 'moonshotai',
    name: 'Kimi 娘',
    basis: 'icon',
    note: '按 Kimi 图标设计：黑底白 K 加一颗蓝点的徽章，深夜蓝长发，水手服',
    hair: '#262d48',
    hairStyle: { back: 'long', fringe: 'blunt', locks: 'mid' },
    eye: '#3d73e0',
    outfit: 'sailor',
    cloth: '#1f2a4d',
    skirt: '#1f2a4d',
    blouse: '#ffffff',
    accent: '#3b82f6',
    logo: { id: 'kimi', side: 'right', colors: { badge: '#15171d', logo: '#ffffff', dot: '#3b82f6' } },
  },
  xai: {
    key: 'xai',
    name: 'Grok 娘 · Ani',
    basis: 'official',
    note: 'xAI 官方二次元形象 Ani：金色双马尾、蓝眼、黑色哥特洋装，别一枚 X 徽章',
    hair: '#f3d27b',
    hairStyle: { back: 'twintails', fringe: 'soft', locks: 'mid', tieMat: 'accent' },
    eye: '#3a6ad8',
    outfit: 'gothic',
    cloth: '#222129',
    skirt: '#222129',
    blouse: '#f5f2f8',
    accent: '#222129',
    legs: '#2a2931',
    shoe: '#1a191f',
    boots: true,
    logo: { id: 'xai', side: 'left', colors: { badge: '#111114', logo: '#ffffff' } },
  },
  meta: {
    key: 'meta',
    name: 'Llama 娘',
    basis: 'icon',
    note: '按 Llama 羊驼设计：奶白卷发、羊驼耳、Meta 无限符号发饰、蓝色水手服',
    hair: '#f1ebdf',
    hairStyle: { back: 'wavy', fringe: 'blunt', locks: 'mid' },
    eye: '#2f6fe0',
    outfit: 'sailor',
    cloth: '#0866ff',
    skirt: '#1f5fd8',
    blouse: '#ffffff',
    accent: '#0866ff',
    ears: { style: 'llama', color: '#efe7d8', inner: '#f2c9b8' },
    logo: { id: 'meta', side: 'right', colors: { logo: '#0866ff' } },
  },
  mistral: {
    key: 'mistral',
    name: 'Mistral 娘',
    basis: 'icon',
    note: '按 Mistral 像素 M 图标设计：黄到红渐变马尾、法式贝雷帽、像素 M 发饰',
    hair: [
      [4, '#ffc23a'],
      [20, '#ff8a1f'],
      [40, '#ec4a1c'],
    ],
    hairStyle: { back: 'ponytail', fringe: 'soft', locks: 'mid', tieMat: 'accent' },
    eye: '#e0561c',
    outfit: 'sailor',
    cloth: '#1f3563',
    skirt: '#1f3563',
    blouse: '#ffffff',
    accent: '#e8391a',
    logo: {
      id: 'mistral',
      side: 'right',
      colors: {
        logo: [
          [10, '#ffd23a'],
          [13, '#ff8a1f'],
          [16, '#e8391a'],
        ],
      },
    },
    extras: [{ kind: 'beret', colors: { beret: '#1f3563' } }],
  },
  nvidia: {
    key: 'nvidia',
    name: 'Nemotron 娘',
    basis: 'icon',
    note: '按英伟达绿眼图标设计：黑长发、荧光绿眼瞳、黑绿机能夹克',
    hair: '#23262b',
    hairStyle: { back: 'long', fringe: 'swept', locks: 'long' },
    eye: '#76b900',
    outfit: 'jacket',
    cloth: '#1f2322',
    skirt: '#1f2322',
    blouse: '#76b900',
    accent: '#76b900',
    legs: '#23262b',
    shoe: '#16181a',
    boots: true,
    logo: { id: 'nvidia', side: 'left', colors: { logo: '#76b900' } },
  },
  cohere: {
    key: 'cohere',
    name: 'Cohere 娘',
    basis: 'icon',
    note: '按 Cohere 三色图标设计：珊瑚色波波头、墨绿外套',
    hair: '#f39a86',
    hairStyle: { back: 'bob', fringe: 'parted', locks: 'short' },
    eye: '#39594d',
    outfit: 'coat',
    cloth: '#39594d',
    skirt: '#39594d',
    blouse: '#39594d',
    accent: '#d18ee2',
    logo: { id: 'cohere', side: 'right', colors: { logo: '#ff7759', logo2: '#39594d', logo3: '#d18ee2' } },
  },
  microsoft: {
    key: 'microsoft',
    name: 'Phi 娘',
    basis: 'icon',
    note: '按微软四色窗格设计：藏青长发、白色实验袍、四色方块发饰',
    hair: '#27335c',
    hairStyle: { back: 'long', fringe: 'parted', locks: 'long' },
    eye: '#00a4ef',
    outfit: 'coat',
    cloth: '#1f2a44',
    skirt: '#f6f8fb',
    blouse: '#f6f8fb',
    accent: '#00a4ef',
    logo: { id: 'microsoft', side: 'left', colors: {} },
  },
  amazon: {
    key: 'amazon',
    name: 'Nova 娘',
    basis: 'icon',
    note: '按亚马逊微笑箭头设计：墨蓝马尾、橙色笑脸箭头发饰、连帽衫',
    hair: '#2b3a4e',
    hairStyle: { back: 'ponytail', fringe: 'swept', locks: 'mid', tieMat: 'accent' },
    eye: '#ff9900',
    outfit: 'hoodie',
    cloth: '#232f3e',
    skirt: '#232f3e',
    blouse: '#ff9900',
    accent: '#ff9900',
    logo: { id: 'amazon', side: 'left', colors: { logo: '#ff9900' } },
  },
  tencent: {
    key: 'tencent',
    name: '混元企鹅娘',
    basis: 'icon',
    note: '按腾讯企鹅设计：黑色波波头、白肚黑衣、红围巾、混元蓝色漩涡发饰',
    hair: '#1e2331',
    hairStyle: { back: 'bob', fringe: 'blunt', locks: 'short' },
    eye: '#2a66e8',
    outfit: 'frill',
    cloth: '#1e2331',
    skirt: '#1e2331',
    blouse: '#ffffff',
    accent: '#ffc21a',
    shoe: '#ffb21a',
    logo: { id: 'hunyuan', side: 'right', colors: { logo: '#0052d9', badge: '#ffffff' } },
    extras: [{ kind: 'scarf', colors: { scarf: '#e23b3b' } }],
  },
  minimax: {
    key: 'minimax',
    name: 'MiniMax 海螺娘',
    basis: 'icon',
    note: '按 MiniMax 声波图标设计：粉色双马尾偶像装、声波发饰（旗下产品线名为海螺）',
    hair: '#f58fb1',
    hairStyle: { back: 'twintails', fringe: 'soft', locks: 'mid', tieMat: 'accent' },
    eye: '#e0407a',
    outfit: 'frill',
    cloth: '#ff5a7a',
    skirt: '#ff6f8c',
    blouse: '#ffffff',
    accent: '#ff3c5f',
    logo: { id: 'minimax', side: 'right', colors: { logo: '#ff3c5f' } },
  },
  xiaomi: {
    key: 'xiaomi',
    name: 'MiMo 娘',
    basis: 'icon',
    note: '按小米橙色圆角图标设计：橙色短发、小米徽章、橙白连帽衫',
    hair: '#ff8a3d',
    hairStyle: { back: 'short', fringe: 'swept', locks: 'short' },
    eye: '#e8601a',
    outfit: 'hoodie',
    cloth: '#ff6900',
    skirt: '#2c2c33',
    blouse: '#ffffff',
    accent: '#ffffff',
    logo: { id: 'xiaomi', side: 'left', colors: { logo: '#ff6900', badge: '#ffffff' } },
  },
  inclusionai: {
    key: 'inclusionai',
    name: '百灵蚁娘',
    basis: 'icon',
    note: '按蚂蚁集团设计：天蓝短发、一对蚂蚁触角、蓝白水手服',
    hair: '#5d9dff',
    hairStyle: { back: 'bob', fringe: 'soft', locks: 'short' },
    eye: '#1677ff',
    outfit: 'sailor',
    cloth: '#1677ff',
    skirt: '#1f5fd0',
    blouse: '#ffffff',
    accent: '#ff7a45',
    extras: [{ kind: 'antenna', colors: { antenna: '#1f5fd0' } }],
  },
  sakana: {
    key: 'sakana',
    name: 'Sakana 鱼娘',
    basis: 'icon',
    note: 'sakana 是日语的「鱼」：红色长发、红鱼发饰、日式水手服',
    hair: '#e5534b',
    hairStyle: { back: 'long', fringe: 'blunt', locks: 'long' },
    eye: '#c2362f',
    outfit: 'sailor',
    cloth: '#1f2a44',
    skirt: '#1f2a44',
    blouse: '#ffffff',
    accent: '#ef4444',
    logo: { id: 'fish', side: 'right', colors: { logo: '#ef4444' } },
  },
  perplexity: {
    key: 'perplexity',
    name: 'Perplexity 娘',
    basis: 'icon',
    note: '按 Perplexity 青色星芒图标设计：青色波波头、圆眼镜（搜索与研究）、青色外套',
    hair: '#2f9a9e',
    hairStyle: { back: 'bob', fringe: 'blunt', locks: 'short' },
    eye: '#1f6f78',
    outfit: 'jacket',
    cloth: '#20808d',
    skirt: '#1c5f68',
    blouse: '#f4fbfb',
    accent: '#f4fbfb',
    logo: { id: 'perplexity', side: 'left', colors: { logo: '#1c6f79' } },
    extras: [{ kind: 'glasses', colors: { frame: '#23373a' } }],
  },
  ibm: {
    key: 'ibm',
    name: 'Granite 娘',
    basis: 'icon',
    note: '按 IBM 条纹字标设计：藏蓝短发、蓝色条纹发饰、正装外套',
    hair: '#1f3a8a',
    hairStyle: { back: 'short', fringe: 'parted', locks: 'mid' },
    eye: '#0f62fe',
    outfit: 'jacket',
    cloth: '#1e2a4a',
    skirt: '#1e2a4a',
    blouse: '#ffffff',
    accent: '#0f62fe',
    logo: { id: 'ibm', side: 'left', colors: { logo: '#0f62fe' } },
  },
  stepfun: {
    key: 'stepfun',
    name: '阶跃娘',
    basis: 'icon',
    note: '按阶跃星辰「阶梯」设计：蓝色马尾、阶梯发饰、连帽衫',
    hair: '#4a78e6',
    hairStyle: { back: 'ponytail', fringe: 'soft', locks: 'mid', tieMat: 'accent' },
    eye: '#1a56db',
    outfit: 'hoodie',
    cloth: '#1a56db',
    skirt: '#1f2a44',
    blouse: '#ffffff',
    accent: '#ffffff',
    logo: { id: 'stairs', side: 'left', colors: { logo: '#ffffff' } },
  },
  baidu: {
    key: 'baidu',
    name: '文心熊娘',
    basis: 'icon',
    note: '按百度熊掌图标设计：棕色长发、熊耳、蓝色熊掌发饰',
    hair: '#6b4533',
    hairStyle: { back: 'long', fringe: 'soft', locks: 'mid' },
    eye: '#2932e1',
    outfit: 'frill',
    cloth: '#2932e1',
    skirt: '#3140e8',
    blouse: '#ffffff',
    accent: '#2932e1',
    ears: { style: 'bear', color: '#6b4533', inner: '#c8927a' },
    logo: { id: 'paw', side: 'right', colors: { logo: '#2932e1' } },
  },
  meituan: {
    key: 'meituan',
    name: 'LongCat 猫娘',
    basis: 'icon',
    note: '按美团龙猫（LongCat）设计：金黄短发、猫耳、美团黄连帽衫',
    hair: '#ffcd3a',
    hairStyle: { back: 'bob', fringe: 'soft', locks: 'short' },
    eye: '#c98a00',
    outfit: 'hoodie',
    cloth: '#ffd100',
    skirt: '#2c2c33',
    blouse: '#2c2c33',
    accent: '#2c2c33',
    ears: { style: 'cat', color: '#ffcd3a', inner: '#ffb3bd' },
  },
  upstage: {
    key: 'upstage',
    name: 'Solar 娘',
    basis: 'icon',
    note: '按 Upstage Solar 设计：紫色长卷发、太阳发饰',
    hair: '#9b72f2',
    hairStyle: { back: 'wavy', fringe: 'parted', locks: 'mid' },
    eye: '#7a4de0',
    outfit: 'frill',
    cloth: '#8b5cf6',
    skirt: '#8b5cf6',
    blouse: '#ffffff',
    accent: '#ffb938',
    logo: { id: 'sun', side: 'right', colors: { logo: '#ffb938' } },
  },
};

/** Model-level variants: a vendor's distinct product line with its own known character. */
interface Variant {
  vendor: string;
  design: string;
  when: (m: VariantProbe) => boolean;
}

export interface VariantProbe {
  id: string;
  name: string;
  imageOut: boolean;
}

const VARIANTS: Variant[] = [
  { vendor: 'openai', design: 'openai/image', when: (m) => m.imageOut || /\b(dall-?e|gpt-image|image)\b/i.test(m.name) },
  { vendor: 'google', design: 'google/gemma', when: (m) => /gemma/i.test(m.id) || /gemma/i.test(m.name) },
];

const FALLBACK_BACKS = ['long', 'bob', 'ponytail', 'short', 'twintails', 'hime'] as const;
const FALLBACK_FRINGES = ['soft', 'blunt', 'swept', 'parted'] as const;
const FALLBACK_OUTFITS = ['sailor', 'hoodie', 'jacket', 'frill', 'coat'] as const;

/** Mid-value version of a brand colour, so near-black or near-white brands still read as hair. */
function wearable(color: string): string {
  const v = color.replace('#', '');
  let [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  if (lum < 60) [r, g, b] = [r, g, b].map((c) => Math.round(c + (110 - lum) * 0.9));
  if (lum > 225) [r, g, b] = [r, g, b].map((c) => Math.round(c - 30));
  return `#${[r, g, b].map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('')}`;
}

export interface VendorLike {
  id: string;
  name: string;
  nameZh: string;
  accentColor: string;
}

/** A fixed, vendor-keyed look for anyone not in the table. */
/** Vendors outside the registry all carry the same neutral grey; give each its own fixed hue instead. */
function brandOrHue(vendor: VendorLike, seed: string): string {
  const v = vendor.accentColor.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
  if (Math.max(r, g, b) - Math.min(r, g, b) > 48) return vendor.accentColor;
  const h = hashInt(seed, 'hue', 360) / 360;
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return Math.round(255 * (0.58 - 0.55 * Math.min(0.58, 0.42) * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return `#${[f(0), f(8), f(4)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

export function fallbackDesign(vendor: VendorLike): Design {
  const seed = `chibi:${vendor.id}`;
  const back = FALLBACK_BACKS[hashInt(seed, 'back', FALLBACK_BACKS.length)];
  const brand = brandOrHue(vendor, seed);
  const hair = wearable(brand);
  const initial = (vendor.name.match(/[A-Za-z0-9]/)?.[0] ?? '?').toUpperCase();
  return {
    key: vendor.id,
    name: `${vendor.nameZh} 娘`,
    basis: 'fallback',
    note: `未收录形象：发色取品牌色，发饰是厂商首字母「${initial}」`,
    hair,
    hairStyle: {
      back,
      fringe: FALLBACK_FRINGES[hashInt(seed, 'fringe', FALLBACK_FRINGES.length)],
      locks: back === 'short' || back === 'bob' ? 'short' : 'mid',
      tieMat: 'accent',
    },
    eye: hair,
    outfit: FALLBACK_OUTFITS[hashInt(seed, 'outfit', FALLBACK_OUTFITS.length)],
    cloth: hair,
    skirt: '#2c2f3a',
    blouse: '#ffffff',
    accent: '#ffffff',
    letter: { char: initial, side: 'left', badge: '#ffffff', ink: hair },
  };
}

export function designFor(vendor: VendorLike, probe: VariantProbe): Design {
  for (const v of VARIANTS) if (v.vendor === vendor.id && v.when(probe)) return gearFor(DESIGNS[v.design], vendor);
  return gearFor(DESIGNS[vendor.id] ?? fallbackDesign(vendor), vendor);
}
