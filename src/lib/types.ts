/**
 * 全站唯一的数据契约。数据管线的产出与前端的消费都以此为准。
 * 任何字段的新增或语义变更都必须同步更新 docs/DATA.md 的仲裁规则表。
 */

/** 数值的可信度。闭源模型的参数量只能是 estimated 或 unknown，绝不标 exact。 */
export type Confidence = 'exact' | 'estimated' | 'unknown';

/** 上游存在只精确到月甚至年的发布日期，精度必须随值一起保存，前端据此决定展示粒度。 */
export type DatePrecision = 'day' | 'month' | 'year';

export type Modality = 'text' | 'image' | 'audio' | 'video' | 'pdf';

/** 数据源标识，用于逐字段记录来源，页面上的署名与 docs/DATA.md 的溯源都依赖它。 */
export type SourceId =
  | 'models.dev'
  | 'epoch.ai'
  | 'huggingface'
  | 'openrouter'
  | 'vercel-gateway'
  | 'litellm'
  /** LiveBench 官方 CSV（Apache-2.0，DATASHEET 明文放弃数据版权） */
  | 'livebench'
  /**
   * LMArena 官方发布的榜单数据集（CC-BY 4.0）。注意这是读权利人自己的发布，
   * 不是抓 arena.ai 的站——后者仍然禁止，区别见 scripts/sync/sources/lmarena.ts。
   */
  | 'lmarena'
  | 'derived'
  | 'override';

/**
 * 榜单指标。键名同时用作擂台赛道的 id。
 *
 * **量纲约定**：准确率/通过率类一律为 0–100 的百分数（上游的 0–1 小数在管线内乘 100）；
 * `eci` 是 Epoch Capabilities Index 的原始指数（当前区间约 0–165），
 * `webdev_arena_elo` 是 Elo 分（当前区间约 1000–1700）。这两项不做任何缩放。
 *
 * **可比性约定**：`swe_bench_verified` 由 Epoch AI 统一复跑，跨模型可比；
 * `swe_bench_vendor` 与 `swe_bench_pro` 来自 models.dev 转载的厂商/榜单自报值，
 * 评测脚手架与 agent 各不相同，**只能同列内比较，永远不要与 Epoch 的分数混算或求平均**。
 * 前端可用 `provenance['benchmarks.<key>']` 区分：`'epoch.ai'` 为第三方复跑，
 * `'models.dev'` 为转载的自报值。
 */
export interface Benchmarks {
  /** Epoch Capabilities Index，综合智力总榜，也是头顶冠冕的判定依据 */
  eci: number | null;
  /** SWE-bench Verified，Epoch AI 统一复跑的模型级成绩，0–100 */
  swe_bench_verified: number | null;
  /**
   * SWE-bench Verified 的厂商/榜单自报版本，0–100。
   * 与 `swe_bench_verified` 严格分列存放，覆盖率更高但未经第三方复核。
   */
  swe_bench_vendor: number | null;
  /**
   * SWE-Bench Pro（Scale AI）的厂商/榜单自报成绩，0–100。
   * 难度显著高于 Verified，分数区间也低得多，不可与上面两列直接比较。
   */
  swe_bench_pro: number | null;
  aime: number | null;
  gpqa_diamond: number | null;
  arc_agi_2: number | null;
  /** Fiction.liveBench 长文本实测 */
  fiction_live: number | null;
  webdev_arena_elo: number | null;
}

/** 分数的量纲。决定前端怎么写单位，也决定它能不能和别的分数放在一起比。 */
export type ScoreUnit =
  /** 0–100 的百分数（通过率、解决率、准确率） */
  | 'pct'
  /** Elo 分，当前区间约 1000–1700 */
  | 'elo'
  /** 无单位指数，如 Epoch Capabilities Index */
  | 'index'
  /** 时长（分钟），如 METR 的「能独立完成多长的任务」 */
  | 'minutes'
  /** 美元，如 Vending-Bench 的经营净值 */
  | 'usd';

/** 成绩由谁测出来的。第三方复核过的成绩在界面上有更强的视觉肯定。 */
export type Attribution = 'third-party' | 'vendor-self-reported';

/**
 * 一条评测成绩。
 *
 * 之所以要有这个结构而不是继续往 `Benchmarks` 上加字段：编程这个维度被切成了
 * 十几个互不兼容的赛制（SWE-bench Verified / Pro / Multilingual、Terminal-Bench、
 * Aider Polyglot、LiveCodeBench……），每接一个就加一个字段的话，
 * 类型、仲裁、前端分档三处都要同步改，而且前端没办法泛化处理。
 *
 * 改成按赛制分列的数组之后，管线只管往里塞，前端按优先级挑一个赛制、
 * 在**该赛制自己的人群里**算分位。跨赛制的分数从此在结构上就不可能相遇。
 */
export interface BenchmarkScore {
  /**
   * 赛制 id，如 'swe_bench_verified'、'aider_polyglot'、'terminal_bench'。
   * 在 `scores[]` 里就是 Epoch `benchmark_metadata.csv` 的 benchmark 列
   * （文件名去掉 `.csv` 与 `_external` 后缀），前端据此查 `src/data/benchmark-registry.ts`。
   */
  league: string;
  score: number;
  unit: ScoreUnit;
  attribution: Attribution;
  /** 这条成绩是从哪个上游源读到的 */
  source: SourceId;
  /** 上游给出的原始出处链接，用于详情页署名。没有就是 null，不要伪造。 */
  sourceUrl: string | null;
}

/**
 * 一个榜单的元信息，来自 Epoch `benchmark_metadata.csv`，管线原样透传。
 *
 * 有了这张表，管线就不必为每个榜单手写解析器：分数列、量纲、是否被新版取代
 * 都由上游声明。Epoch 新增一个榜单，下一次同步它就自动出现在站上——
 * 这是「发布后不用人管」在榜单维度上的落地。前端的中文名与分类在
 * `src/data/benchmark-registry.ts` 里查表，查不到就回落到自动生成的标签。
 */
export interface BenchmarkMeta {
  /** 与 `BenchmarkScore.league` 一致 */
  id: string;
  sourceFile: string;
  scoreColumn: string;
  unit: ScoreUnit;
  /** 随机作答的基线分，用于把「刚过基线」和「真会」区分开。没有就是 null。 */
  randomBaseline: number | null;
  /** 满分。没有就是 null（Elo、时长等无上限的量纲）。 */
  scoreCeiling: number | null;
  releaseDate: string | null;
  /** 被哪个新版榜单取代。非 null 的榜单默认不再单独开榜。 */
  supersededBy: string | null;
  /** 是否参与 Epoch Capabilities Index 的合成 */
  inEci: boolean;
  /** 本快照里有多少个模型在这个榜上有成绩 */
  models: number;
}

export interface Pricing {
  /** 统一为美元每百万 token。上游存在 $/token 与字符串科学计数法，归一化在管线内完成。 */
  inputPerMTok: number | null;
  outputPerMTok: number | null;
  cachedInputPerMTok: number | null;
}

export interface Params {
  totalB: number | null;
  /** MoE 模型的激活参数量 */
  activeB: number | null;
  confidence: Confidence;
  /**
   * 1–5 档的「体型」推定，给参数量未公开的模型兜底。
   * 由「输出价格档位 × 厂商命名档位」合成，是**补充信号而非替代**——
   * 前端自校准的分位数档位（src/lib/derive.ts 的 buildSizeScale）优先级更高，
   * 这一档只在自校准无输入（totalB 为 null）时才该被用到。
   */
  sizeTier?: 1 | 2 | 3 | 4 | 5;
  /** sizeTier 的推定依据，决定 UI 上「按定价推定 / 按命名推定」的措辞 */
  sizeTierBasis?: 'price+naming' | 'price' | 'naming';
}

export interface Capabilities {
  toolCall: boolean | null;
  reasoning: boolean | null;
  structuredOutput: boolean | null;
  promptCaching: boolean | null;
}

export interface ModelRecord {
  /** 规范 id，形如 "openai/gpt-5.3"。跨源合并的连接键。 */
  id: string;
  /** URL 片段，由 id 转义而来 */
  slug: string;
  name: string;
  vendorId: string;

  releaseDate: string | null;
  releaseDatePrecision: DatePrecision | null;
  knowledgeCutoff: string | null;
  /** 非 null 即已退役，角色转为幽灵态并迁入往生堂 */
  retiredAt: string | null;

  contextWindow: number | null;
  maxOutput: number | null;
  pricing: Pricing;

  modalities: { input: Modality[]; output: Modality[] };
  capabilities: Capabilities;

  openWeights: boolean | null;
  /** 归一化后的 SPDX 标识，无法确定时为 null 而非猜测值 */
  license: string | null;

  params: Params;
  benchmarks: Benchmarks;
  /**
   * 编程能力的**全部**可用成绩，一个赛制一条，按可信度降序。
   * 空数组表示「确实没有查到任何公开成绩」，而不是「这个模型不会写代码」——
   * 界面上必须把这两件事说清楚。
   *
   * 与 `benchmarks.swe_bench_*` 三列的关系：那三列是历史契约，
   * 排行榜与 `benchmarks` 相关的旧逻辑仍在读它们；这个数组是超集。
   */
  coding: BenchmarkScore[];
  /**
   * **全部**评测成绩，一个榜单一条，是 `coding[]` 与 `benchmarks.*` 的超集。
   * 数学、科学、长文本、多模态、智能体、游戏、写作……凡是 Epoch zip 里
   * 通过了合规过滤的榜单都在这里。`league` 对应 `WorldSnapshot.benchmarks[].id`。
   *
   * 可选字段：旧快照没有它，前端必须能在它缺席时回落到 `benchmarks` 与 `coding`。
   */
  scores?: BenchmarkScore[];
  /**
   * 训练算力（FLOP），来自 Epoch `model_metadata.csv`。
   * 闭源模型从不公布参数量，训练算力是唯一有第三方估算的「体型」代理。
   * null 表示 Epoch 也没有估算。
   */
  trainingComputeFlop?: number | null;

  /** 逐字段来源，键为本接口的字段路径，值为数据源标识 */
  provenance: Partial<Record<string, SourceId>>;
  /** 首次被管线发现的时间，用于「新生」判定与编年史补漏 */
  firstSeenAt: string;
}

/**
 * 世界的两个区域：`east` 是国内（总部在中国大陆的厂商），`west` 是国外（其余全部）。
 * 键名沿用早期的东西大陆叙事以免动到管线与快照，界面文案在 i18n 里统一叫「国内 / 国外」。
 * 新厂商按总部所在国自动归位。
 */
export type Continent = 'west' | 'east';

export interface Vendor {
  id: string;
  name: string;
  nameZh: string;
  /** ISO 3166-1 alpha-2，总部所在国 */
  country: string;
  continent: Continent;
  /**
   * 形象母题，决定角色的种族特征与配色基调，例如 deepseek 的鲸鱼。
   * 未知厂商回落到 'wanderer'（神秘旅人），这是零维护承诺的兜底。
   */
  motif: string;
  /** 家族纹章与服饰的主色，十六进制 */
  accentColor: string;
  homepage: string | null;
}

/** 管线产出的完整快照，即 data/models.json 的顶层结构。 */
export interface WorldSnapshot {
  /** 快照生成时刻，ISO 8601 */
  generatedAt: string;
  /** 各上游源本次抓取的成功与否及其时间戳，用于页面上的数据新鲜度提示 */
  sources: Record<SourceId, { ok: boolean; fetchedAt: string | null; note?: string }>;
  vendors: Vendor[];
  models: ModelRecord[];
  /**
   * 本快照涉及的全部榜单的元信息，见 `BenchmarkMeta`。
   * 可选：旧快照没有它，前端要能在缺席时只用 `benchmarks` 的固定字段开榜。
   */
  benchmarks?: BenchmarkMeta[];
}

/**
 * 变更日志条目：sync 后比较新旧快照得出，存于 data/changelog.json。
 * 由 scripts/sync/lib/changelog.ts 生成，站点 /changelog/ 与 RSS 消费，
 * 速报 issue 也读同一份——三处永远一致。
 */
export interface ChangeEntry {
  /** 快照生成时刻（ISO），同时充当条目 id，重复的快照不会写两条 */
  date: string;
  /** 供 GitHub issue / RSS 使用的预排版摘要（markdown） */
  summary: string;
  newModels: { id: string; name: string; slug: string; vendorZh: string }[];
  retired: { id: string; name: string; slug: string; vendorZh: string }[];
  newVendors: { id: string; nameZh: string }[];
  flagships: { vendorId: string; vendorZh: string; before: string; after: string; slug: string }[];
  champions: { key: string; label: string; before: string; after: string; slug: string }[];
}
