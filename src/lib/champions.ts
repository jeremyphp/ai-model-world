/**
 * 首屏「今日格局」：八个问题，八个答案，每个答案是一个模型。
 *
 * 这个站的使命是「点进来一眼看懂当下格局」。广场上几十间屋子再清楚，
 * 也需要读者自己扫一遍再下结论；这一条横幅把结论直接摆出来：
 * 谁最聪明、谁最会编程、谁最划算、谁最便宜、谁记性最好、谁最新、国内谁最强、开源谁最强。
 *
 * 全部从数据里算出来，没有任何人工钦点。与 persona.ts 用同一套判据
 * （ECI、多榜编程共识分、分位差性价比、文本输出价格），所以横幅上说
 * 「最会编程」的那个模型，它自己的卡片上人设也一定是「全世界最会写代码的模型」，
 * 两处不会打架。
 *
 * 一切纯函数、确定性、不依赖当前时间以外的任何外部状态。
 */

import type { ModelRecord, Vendor } from './types';
import { buildValueScore, daysSince, rankByEci } from './derive';
import { formatCount } from './format';
import { buildCodingConsensus } from './coding-consensus';

/** 卡片上放不下「$0.10 / 百万 tokens」，用短写法 */
function shortPrice(usd: number): string {
  // 像素字体下「0.080」的 8 和 0 几乎分不清，末尾补零只添乱：两位小数够用
  if (usd < 1) return `$${usd.toFixed(2)}`;
  if (usd < 10) return `$${usd.toFixed(1)}`;
  return `$${Math.round(usd)}`;
}

export type ChampionKey =
  | 'smart'
  | 'code'
  | 'value'
  | 'cheap'
  | 'memory'
  | 'newest'
  | 'east'
  | 'open';

export interface Champion {
  key: ChampionKey;
  model: ModelRecord;
  vendor: Vendor | undefined;
  /** 卡片上那个最大的数字或短语，如「ECI 162」「$0.10」「3 天前」 */
  figure: string;
  /** figure 下面一行的小字，交代它凭什么拿这个头衔 */
  detail: string;
  /** 综合智力全球名次，用于在卡片上显示 #N；没有就是 null */
  rank: number | null;
}

/** 只把输出文本的模型算进价格比较；按张/按分钟计费的折算成 per-token 会得到假值 */
function textPrice(m: ModelRecord): number | null {
  if (!m.modalities.output.includes('text')) return null;
  const p = m.pricing.outputPerMTok;
  return p != null && p > 0 ? p : null;
}

function releaseTime(m: ModelRecord): number | null {
  if (!m.releaseDate) return null;
  const p = m.releaseDate.split('-').map(Number);
  const t = Date.UTC(p[0], (p[1] ?? 1) - 1, p[2] ?? 1);
  return Number.isNaN(t) ? null : t;
}

/**
 * 在候选里找一个「值最大」的模型。同值时 ECI 高者优先、再按 id 字典序，保证确定性。
 * `value` 返回 null 的模型不参与。
 */
function best(
  pool: ModelRecord[],
  value: (m: ModelRecord) => number | null,
  order: 'desc' | 'asc' = 'desc',
): { model: ModelRecord; value: number } | null {
  let pick: { model: ModelRecord; value: number } | null = null;
  for (const m of pool) {
    const v = value(m);
    if (v == null) continue;
    if (!pick) {
      pick = { model: m, value: v };
      continue;
    }
    const better = order === 'desc' ? v > pick.value : v < pick.value;
    const tie = v === pick.value;
    if (better) pick = { model: m, value: v };
    else if (tie) {
      const a = m.benchmarks.eci ?? -1;
      const b = pick.model.benchmarks.eci ?? -1;
      if (a > b || (a === b && m.id < pick.model.id)) pick = { model: m, value: v };
    }
  }
  return pick;
}

export function buildChampions(
  models: ModelRecord[],
  vendors: Vendor[],
  now: Date,
  /** 形象注册表里有没有这家厂商。「最新发布」「最便宜」只在正规厂商里选，否则会被社区微调刷屏 */
  registryHas: (vendorId: string) => boolean,
): Champion[] {
  const vendorOf = new Map(vendors.map((v) => [v.id, v]));
  const alive = models.filter((m) => !m.retiredAt);
  const ranks = rankByEci(alive);
  const valueOf = buildValueScore(alive);
  const codingOf = buildCodingConsensus(alive);
  // 「聪明榜」上有名字的模型，用作「便宜 / 记性」这类比较的准入门槛：
  // 没被任何第三方测过的模型即使再便宜，说它「最便宜」对读者也没有决策价值
  const scored = alive.filter((m) => m.benchmarks.eci != null);
  const trusted = alive.filter((m) => registryHas(m.vendorId));

  const out: Champion[] = [];
  const push = (
    key: ChampionKey,
    hit: { model: ModelRecord; value: number } | null,
    figure: (v: number, m: ModelRecord) => string,
    detail: (v: number, m: ModelRecord) => string,
  ) => {
    if (!hit) return;
    out.push({
      key,
      model: hit.model,
      vendor: vendorOf.get(hit.model.vendorId),
      figure: figure(hit.value, hit.model),
      detail: detail(hit.value, hit.model),
      rank: ranks.get(hit.model.id) ?? null,
    });
  };

  push(
    'smart',
    best(alive, (m) => m.benchmarks.eci),
    (v) => `ECI ${v.toFixed(0)}`,
    () => `综合智力指数，${scored.length} 个受测模型中第一`,
  );

  /*
   * 编程不取单一榜单。Epoch 复跑的 SWE-bench Verified 只有 25 个模型，
   * 最新一代旗舰往往还没轮到，单榜取最大值会把头衔颁给「被测得最早」的老模型。
   * 改用多榜共识：在所有第三方编程榜上的平均分位，至少参加 3 榜。见 coding-consensus.ts。
   */
  push(
    'code',
    best(alive, (m) => codingOf(m)?.score ?? null),
    (v) => `前 ${Math.max(1, Math.round((1 - v) * 100))}%`,
    (_v, m) => `${codingOf(m)!.leagues} 个第三方编程榜的平均排名最高`,
  );

  push(
    'value',
    best(alive, valueOf),
    (_v, m) => `${shortPrice(m.pricing.outputPerMTok!)}/M`,
    (_v, m) => `智力峡谷 #${ranks.get(m.id)}，价格远低于同级`,
  );

  push(
    'cheap',
    best(scored, textPrice, 'asc'),
    (v) => `${shortPrice(v)}/M`,
    () => '有第三方评测成绩的模型里，输出最便宜',
  );

  push(
    'memory',
    best(scored, (m) => m.contextWindow),
    (v) => `${formatCount(v)} tokens`,
    () => '上下文窗口，一次能读进去的字数',
  );

  push(
    'newest',
    best(
      trusted.filter((m) => {
        const t = releaseTime(m);
        return t != null && t <= now.getTime();
      }),
      releaseTime,
    ),
    (_v, m) => {
      const d = daysSince(m.releaseDate, now) ?? 0;
      return d <= 0 ? '今天' : `${d} 天前`;
    },
    (_v, m) => `${m.releaseDate} 发布`,
  );

  push(
    'east',
    best(
      alive.filter((m) => vendorOf.get(m.vendorId)?.continent === 'east'),
      (m) => m.benchmarks.eci,
    ),
    (v) => `ECI ${v.toFixed(0)}`,
    (_v, m) => `国内第一，峡谷 #${ranks.get(m.id)}`,
  );

  push(
    'open',
    best(
      alive.filter((m) => m.openWeights === true),
      (m) => m.benchmarks.eci,
    ),
    (v) => `ECI ${v.toFixed(0)}`,
    (_v, m) => `开源第一，峡谷 #${ranks.get(m.id)}`,
  );

  return out;
}
