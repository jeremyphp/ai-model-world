import type { ModelRecord } from './types';
import { buildValueScore, daysSince } from './derive';
import { buildCodingConsensus } from './coding-consensus';

/**
 * 自动特征标签。
 *
 * 起因是一个反复出现的问题：屋子里堆了十来个视觉信号，每个都很小，
 * 结果哪个都不醒目，普通人扫一眼说不出这些模型到底差在哪。
 *
 * 标签的作用是把「差异」直接翻译成人话。它们全部由数据算出——
 * 谁符合谁挂上，不符合就摘掉。排名掉出前十，「前十强」当天就没了；
 * 发布满 30 天，「刚出生」自动过期。没有任何一块标签是写死在模型身上的。
 *
 * 每间屋子最多挂三块，按「越稀有越靠前」排序：
 * 满屏都是「支持工具调用」这种九成模型都有的标签，等于没有标签。
 */

export type TraitTone = 'crown' | 'good' | 'cool' | 'costly' | 'aged';

export interface Trait {
  id: string;
  label: string;
  tone: TraitTone;
  /** 悬停时说明这块牌子凭什么挂上去，避免变成没有依据的营销词 */
  title: string;
}

export interface TraitContext {
  eciRank: Map<string, number>;
  sweRank: Map<string, number>;
  valueRank: Map<string, number>;
  contextRank: Map<string, number>;
  cheapRank: Map<string, number>;
  /** 参与定价的模型总数，用于把名次换算成分位 */
  pricedCount: number;
}

function rankBy(
  models: ModelRecord[],
  value: (m: ModelRecord) => number | null,
  order: 'desc' | 'asc' = 'desc',
): Map<string, number> {
  const scored = models
    .map((m) => ({ id: m.id, v: value(m) }))
    .filter((x): x is { id: string; v: number } => x.v != null);
  scored.sort((a, b) => (order === 'desc' ? b.v - a.v : a.v - b.v) || a.id.localeCompare(b.id));
  return new Map(scored.map((x, i) => [x.id, i + 1]));
}

// 性价比的算法见 derive.ts 的 buildValueScore：曾经用 eci/price 的比值，
// 分母趋零时会爆炸，导致这块牌子永远颁给最便宜的老模型。已改为分位差。

function textPrice(m: ModelRecord): number | null {
  // 语音转写、图像生成这类按分钟或按张计费的模型折算成 per-token 会得到接近 0 的假值，
  // 混进价格排名会得出「最便宜的是它们」的错误结论
  if (!m.modalities.output.includes('text')) return null;
  const p = m.pricing.outputPerMTok;
  return p != null && p > 0 ? p : null;
}

export function buildTraitContext(models: ModelRecord[]): TraitContext {
  const valueScore = buildValueScore(models);
  // 编程排名用多榜共识分而不是单一榜单：单榜取最大值会把「编程第一」
  // 颁给被测得最早的老模型（见 coding-consensus.ts 的翻车记录）
  const codingOf = buildCodingConsensus(models);
  return {
    eciRank: rankBy(models, (m) => m.benchmarks.eci),
    sweRank: rankBy(models, (m) => codingOf(m)?.score ?? null),
    valueRank: rankBy(models, valueScore),
    contextRank: rankBy(models, (m) => m.contextWindow),
    cheapRank: rankBy(models, textPrice, 'asc'),
    pricedCount: models.filter((m) => textPrice(m) != null).length,
  };
}

const YEAR = 365;

/** 这些标签本身就稀有（全球第一、退役），无论出现多少次都不该被剪掉 */
const NEVER_PRUNE = new Set(['strongest', 'best-coder', 'best-memory', 'cheapest', 'retired']);

/** 一块标签在展示集合里的出现率超过这个比例就没有区分价值了 */
const COMMON_THRESHOLD = 0.35;

/** 按稀有度从高到低排列。顺序即优先级，裁剪与截断交给 assignTraits。 */
function matchTraits(model: ModelRecord, ctx: TraitContext, now: Date): Trait[] {
  const out: Trait[] = [];
  const push = (t: Trait) => out.push(t);

  const eci = ctx.eciRank.get(model.id);
  const swe = ctx.sweRank.get(model.id);
  const value = ctx.valueRank.get(model.id);
  const ctxRank = ctx.contextRank.get(model.id);
  const cheap = ctx.cheapRank.get(model.id);
  const age = daysSince(model.releaseDate, now);

  if (eci === 1) {
    push({ id: 'strongest', label: '峡谷第一', tone: 'crown', title: '综合智力指数峡谷第一' });
  } else if (eci != null && eci <= 5) {
    push({ id: 'top5', label: '五强', tone: 'crown', title: `综合智力第 ${eci} 名` });
  } else if (eci != null && eci <= 10) {
    push({ id: 'top10', label: '十强', tone: 'crown', title: `综合智力第 ${eci} 名` });
  }

  if (swe === 1) {
    push({ id: 'best-coder', label: '编程第一', tone: 'cool', title: '第三方编程榜平均排名峡谷第一' });
  } else if (swe != null && swe <= 5) {
    push({ id: 'coder', label: '编程好手', tone: 'cool', title: `第三方编程榜平均排名第 ${swe} 名` });
  }

  if (ctxRank === 1) {
    push({ id: 'best-memory', label: '记性最好', tone: 'cool', title: '上下文窗口峡谷最大' });
  } else if (model.contextWindow != null && model.contextWindow >= 1_000_000) {
    push({ id: 'million', label: '百万记性', tone: 'cool', title: '上下文窗口达到百万 tokens' });
  }

  if (value != null && value <= 3) {
    push({ id: 'best-value', label: '性价比之王', tone: 'good', title: `每块钱买到的智力排第 ${value}` });
  }

  if (cheap === 1) {
    push({ id: 'cheapest', label: '全场最便宜', tone: 'good', title: '输出单价峡谷最低' });
  } else if (cheap != null && ctx.pricedCount > 0 && cheap <= ctx.pricedCount * 0.15) {
    push({ id: 'cheap', label: '白菜价', tone: 'good', title: '输出单价处于最便宜的 15%' });
  } else if (
    cheap != null &&
    ctx.pricedCount > 0 &&
    cheap > ctx.pricedCount * 0.95
  ) {
    push({ id: 'costly', label: '天价', tone: 'costly', title: '输出单价处于最贵的 5%' });
  }

  if (age != null && age <= 30) {
    push({ id: 'newborn', label: '刚出生', tone: 'good', title: `${age} 天前发布` });
  } else if (age != null && age > YEAR * 2) {
    push({
      id: 'elder',
      label: '元老',
      tone: 'aged',
      title: `发布已超过 ${Math.floor(age / YEAR)} 年`,
    });
  }

  if (model.retiredAt) {
    // 退役是最重要的状态，必须排到最前面
    out.unshift({ id: 'retired', label: '已退役', tone: 'aged', title: `${model.retiredAt} 下线` });
  }

  // 兜底标签放在最后，只有前面全没命中、且经过稀有度裁剪后依然空手时才会露面
  if (model.openWeights === true) {
    push({ id: 'open', label: '开源', tone: 'good', title: '权重公开，可自行部署' });
  }
  if (model.capabilities.reasoning === true) {
    push({ id: 'reasoning', label: '会深思', tone: 'cool', title: '推理型模型，回答前会先思考' });
  }

  return out;
}

/**
 * 给一批要同屏展示的模型分配标签。
 *
 * 关键的一步是**稀有度裁剪**：一块标签如果这一屏里超过三分之一的模型都挂着，
 * 它就不再有区分价值了——「百万记性」在旗舰模型里几乎人手一块，
 * 满屏挂着等于没挂。所以先算出每块标签在这批模型里的出现率，
 * 太普遍的直接剪掉，只留下真正把这个模型和邻居区分开的那几块。
 *
 * 这也是自校准的：等哪天百万上下文变成稀罕事，这块标签会自动重新出现。
 */
export function assignTraits(
  models: ModelRecord[],
  ctx: TraitContext,
  now: Date,
  maxPerModel = 3,
): Map<string, Trait[]> {
  const matched = new Map<string, Trait[]>();
  const freq = new Map<string, number>();

  for (const m of models) {
    const traits = matchTraits(m, ctx, now);
    matched.set(m.id, traits);
    for (const t of traits) freq.set(t.id, (freq.get(t.id) ?? 0) + 1);
  }

  const limit = models.length * COMMON_THRESHOLD;
  const result = new Map<string, Trait[]>();
  for (const [id, traits] of matched) {
    const kept = traits.filter((t) => NEVER_PRUNE.has(t.id) || (freq.get(t.id) ?? 0) <= limit);
    result.set(id, kept.slice(0, maxPerModel));
  }
  return result;
}
