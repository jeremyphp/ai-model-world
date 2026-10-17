/**
 * 一句话人设：从宽到窄找出「这个模型在哪个范围里是第一」。
 *
 * 卡片上已经有跑分、有排名、有彩色标签，唯独缺一句「所以它是个什么角色」。
 * 属性面板只负责把数字摆出来，结论还得读者自己下；对一个面向完全不懂大模型的人
 * 的站点来说，那一步恰恰是最难的一步。
 *
 * ## 核心机制
 *
 * 枚举「维度 × 限定域」的所有组合，只保留这个模型排第一的那些，
 * 然后**先按维度重要性、再按域最宽**挑一条，套成一句话。
 *
 * 「最便宜」很平庸，「**十强里**最便宜」既稀有又有用——这个技巧来自
 * LLM Stats 首屏的 `cheapest in the top 10`。限定域同时交代了三件事：
 * 它在这个圈子里、这个圈子有门槛、它在圈子里拔尖。十来个字给三个事实。
 *
 * ## 两个容易搞反的地方
 *
 * **域要从宽到窄，不是从窄到宽。** 直觉上「域越窄越具体越好」，
 * 但对全球第一的模型来说，「百万上下文的模型里综合智力最强」
 * 远不如「全世界综合智力最强」有力。正确做法是找**站得住的最宽说法**。
 *
 * **域必须有下限。** 在一个只有两个成员的圈子里当第一毫无信息量，
 * 所以要求域内至少 5 个成员，否则这句话会退化成同义反复。
 *
 * ## 为什么模板化在这里不会生硬
 *
 * 生硬来自泛化而不是模板——「一款性能优秀的大语言模型」对谁都成立，
 * 所以对谁都没用。而「在某个域里排第一」这个条件从结构上保证了
 * 同一句话在全站最多属于一个模型。
 *
 * 全程不调用任何 LLM：纯查表、排序、字符串拼接，离线确定性可复现。
 */

import type { ModelRecord, Vendor } from './types';
import { bookshelfOf, buildPriceScale, buildValueScore, rankByEci, type PriceScale } from './derive';
import { buildCodingConsensus, type CodingConsensus } from './coding-consensus';

// ─── 维度 ─────────────────────────────────────────────────────

interface Dimension {
  id: string;
  /** 「综合智力最强」里的那一段 */
  superlative: string;
  /** 取值。返回 null 表示这个模型不参与该维度的排名。 */
  value(m: ModelRecord): number | null;
  /** 值越大越好还是越小越好 */
  order: 'desc' | 'asc';
}

/**
 * 只把输出文本的模型算进价格排名。
 * 语音转写、图像生成这类按分钟或按张计费的，折算成 per-token 会得到接近 0 的假值，
 * 混进来会让「最便宜」这个结论出错。
 */
function textPrice(m: ModelRecord): number | null {
  if (!m.modalities.output.includes('text')) return null;
  const p = m.pricing.outputPerMTok;
  return p != null && p > 0 ? p : null;
}

/**
 * 维度顺序即优先级：一个模型同时满足多条时，取靠前的那条来说。
 *
 * 「最划算」排在「最便宜」前面：便宜但不好用是没有价值的，
 * 而划算这个结论对读者的决策更有用。
 */
function dimensionsFor(
  valueOf: (m: ModelRecord) => number | null,
  codingOf: (m: ModelRecord) => CodingConsensus | null,
): Dimension[] {
  return [
    { id: 'intelligence', superlative: '综合智力第一', value: (m) => m.benchmarks.eci, order: 'desc' },
    /*
     * 编程用的是多榜共识分（见 coding-consensus.ts），不是单一榜单的原始分。
     * 单榜取最大值会把「最会写代码」颁给被测得最早的老模型——已经翻过一次车。
     */
    { id: 'coding', superlative: '最会写代码', value: (m) => codingOf(m)?.score ?? null, order: 'desc' },
    { id: 'memory', superlative: '记性最好', value: (m) => m.contextWindow, order: 'desc' },
    { id: 'value', superlative: '最划算', value: valueOf, order: 'desc' },
    { id: 'cheap', superlative: '最便宜', value: textPrice, order: 'asc' },
  ];
}

// ─── 限定域 ───────────────────────────────────────────────────

interface Domain {
  id: string;
  /** 「开源模型里」这一段。全世界那一档是空前缀加「全世界」。 */
  prefix: string;
  member(m: ModelRecord, v: Vendor | undefined): boolean;
}

/** 域顺序即宽窄：靠前的更宽，挑选时优先。 */
const DOMAINS: Domain[] = [
  { id: 'all', prefix: '全峡谷', member: () => true },
  { id: 'open', prefix: '开源模型里', member: (m) => m.openWeights === true },
  { id: 'east', prefix: '国内厂商里', member: (_m, v) => v?.continent === 'east' },
  { id: 'west', prefix: '国外厂商里', member: (_m, v) => v?.continent === 'west' },
  {
    id: 'million',
    prefix: '百万上下文的模型里',
    member: (m) => m.contextWindow != null && m.contextWindow >= 1_000_000,
  },
  { id: 'vision', prefix: '看得懂图的模型里', member: (m) => m.modalities.input.includes('image') },
  /*
   * 「十强里最便宜」这类说法是这套机制最有价值的产出：一个全局排第 10 的模型
   * 在这个圈子里可能是压倒性的第一，而「全世界最便宜」那句话轮不到它。
   * 十强的成员由 ECI 名次决定，随榜单每日变化，不需要人工维护。
   */
  { id: 'top10', prefix: '十强里', member: () => false },
];

/** top10 的成员判定要先算完排名才知道，所以单独在建上下文时注入 */
const TOP10 = 10;

/** 域内成员少于这个数时，「第一名」这个说法没有信息量 */
const MIN_DOMAIN_SIZE = 5;

// ─── 兜底用的档位词 ───────────────────────────────────────────

const PRICE_WORDS = ['白菜价', '便宜', '中等价位', '偏贵', '天价'];
const MEMORY_WORDS = ['记性短', '记性一般', '记性不错', '记性很好', '能读长文'];

// ─── 上下文的生活化锚点 ───────────────────────────────────────

/**
 * 「1,000,000 tokens」对普通人是个天文数字，说「约等于一次读完哈利·波特全七部」
 * 才有体感。这是一张写死的换算表，与 `vendor-registry.ts` 同性质——
 * 唯一依赖人类常识的一层，加不加系统都能跑。
 *
 * 换算按中文约 1.5 字/token、英文约 0.75 词/token 取保守值，
 * 措辞一律用「约」，不给精确数字。
 */
const CONTEXT_ANCHORS: Array<{ min: number; text: string }> = [
  { min: 2_000_000, text: '一次能读完一整套长篇小说' },
  { min: 1_000_000, text: '一次能读完《哈利·波特》全七部' },
  { min: 500_000, text: '一次能读完《三体》三部曲' },
  { min: 200_000, text: '一次能读完一本《三体》' },
  { min: 100_000, text: '一次能读完一本中篇小说' },
  { min: 32_000, text: '一次能读完一篇长论文' },
  { min: 0, text: '一次只能读几千字' },
];

export function contextAnchor(tokens: number | null): string | null {
  if (tokens == null || tokens <= 0) return null;
  return CONTEXT_ANCHORS.find((a) => tokens >= a.min)?.text ?? null;
}

// ─── 人设上下文 ───────────────────────────────────────────────

export interface PersonaContext {
  /** `${dimensionId}|${domainId}` → 该组合的第一名模型 id */
  champions: Map<string, string>;
  /** 域 id → 成员数，用于过滤掉太小的圈子 */
  domainSize: Map<string, number>;
  /** 与 champions 里的键同源，供 personaFor 按同样的顺序遍历 */
  dimensions: Dimension[];
  priceScale: PriceScale;
  vendorOf: (id: string) => Vendor | undefined;
  /** 综合智力全球名次，供二级兜底用 */
  ranks: Map<string, number>;
}

/** 名次在这以内的模型，兜底句直接报名次——「全球第 7 聪明」比「天价、会看图」有用得多 */
const RANKED_PERSONA_LIMIT = 30;

export function buildPersonaContext(models: ModelRecord[], vendors: Vendor[]): PersonaContext {
  const byId = new Map(vendors.map((v) => [v.id, v]));
  const vendorOf = (id: string) => byId.get(id);

  // 十强名单：综合智力前 10。没有分数的模型不参与。
  const topTen = new Set(
    models
      .filter((m) => m.benchmarks.eci != null)
      .sort((a, b) => b.benchmarks.eci! - a.benchmarks.eci! || a.id.localeCompare(b.id))
      .slice(0, TOP10)
      .map((m) => m.id),
  );

  const dimensions = dimensionsFor(buildValueScore(models), buildCodingConsensus(models));
  const champions = new Map<string, string>();
  const domainSize = new Map<string, number>();

  for (const domain of DOMAINS) {
    const isMember =
      domain.id === 'top10'
        ? (m: ModelRecord) => topTen.has(m.id)
        : (m: ModelRecord) => domain.member(m, vendorOf(m.vendorId));
    const members = models.filter(isMember);
    domainSize.set(domain.id, members.length);
    if (members.length < MIN_DOMAIN_SIZE) continue;

    for (const dim of dimensions) {
      const scored = members
        .map((m) => ({ m, v: dim.value(m) }))
        .filter((x): x is { m: ModelRecord; v: number } => x.v != null);
      if (scored.length < MIN_DOMAIN_SIZE) continue;

      // id 字典序做最终的稳定排序，保证同分时结果可复现
      scored.sort((a, b) =>
        dim.order === 'desc' ? b.v - a.v || a.m.id.localeCompare(b.m.id) : a.v - b.v || a.m.id.localeCompare(b.m.id),
      );
      champions.set(`${dim.id}|${domain.id}`, scored[0].m.id);
    }
  }

  return {
    champions,
    domainSize,
    dimensions,
    priceScale: buildPriceScale(models),
    vendorOf,
    ranks: rankByEci(models.filter((m) => !m.retiredAt)),
  };
}

/**
 * 二级兜底：没有在任何域里拿第一时，改用纯事实拼接的定位式描述。
 *
 * 前排的模型先报名次：「全球第 7 聪明的模型，偏贵」。
 * 广场上并排的旗舰大多拿不到任何「第一」，早先它们的人设清一色是
 * 「天价、能读长文、会看图的模型」——三张卡片一句话，等于没说。
 * 名次是它们之间最大的差别，就该先说名次。
 *
 * 其余的用「便宜、能读长文、会看图的开源模型」这类拼接——每一段都对应一个具体字段，
 * 组合起来仍然能把这个模型和邻居区分开，而且完全没有编造。
 */
function positioning(model: ModelRecord, ctx: PersonaContext): string | null {
  const bits: string[] = [];

  const priceTier = ctx.priceScale.tierOf(model.pricing.outputPerMTok);
  if (priceTier != null) bits.push(PRICE_WORDS[priceTier - 1]);

  const rank = ctx.ranks.get(model.id);
  if (rank != null && rank <= RANKED_PERSONA_LIMIT) {
    const extra: string[] = [];
    if (priceTier != null) extra.push(PRICE_WORDS[priceTier - 1]);
    if (model.modalities.input.includes('image')) extra.push('会看图');
    else if (model.capabilities.reasoning === true) extra.push('会深思');
    const tail = extra.length > 0 ? `，${extra.join('、')}` : '';
    return `综合智力峡谷第 ${rank}${tail}`;
  }

  const shelf = bookshelfOf(model);
  if (shelf != null) bits.push(MEMORY_WORDS[shelf - 1]);

  if (model.modalities.input.includes('image')) bits.push('会看图');
  else if (model.capabilities.reasoning === true) bits.push('会深思');

  if (bits.length === 0) return null;
  const kind = model.openWeights === true ? '开源模型' : '模型';
  return `${bits.join('、')}的${kind}`;
}

/**
 * 生成一句话人设。
 *
 * 三级阶梯，绝不留空也绝不编造：
 * 一级是限定域最高级，二级是定位式描述，三级老实承认资料不足。
 */
export function personaFor(model: ModelRecord, ctx: PersonaContext): string {
  for (const dim of ctx.dimensions) {
    for (const domain of DOMAINS) {
      if ((ctx.domainSize.get(domain.id) ?? 0) < MIN_DOMAIN_SIZE) continue;
      if (ctx.champions.get(`${dim.id}|${domain.id}`) !== model.id) continue;
      // 「全世界最便宜的」读着别扭，补一个「的模型」收尾
      return `${domain.prefix}${dim.superlative}的模型`;
    }
  }

  return positioning(model, ctx) ?? '上游只收录了它的基本信息，还没有公开的评测成绩';
}
