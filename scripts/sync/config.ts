import path from 'node:path';
import fs from 'node:fs';

function findRepoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i += 1) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

export const ROOT = findRepoRoot();
export const DATA_DIR = path.join(ROOT, 'data');
export const RAW_DIR = path.join(DATA_DIR, 'raw');
export const CACHE_DIR = path.join(DATA_DIR, '.cache');
export const SNAPSHOT_PATH = path.join(DATA_DIR, 'models.json');
export const PARAMS_TIER_PATH = path.join(DATA_DIR, 'params-tier.json');
export const BENCHMARK_ATTRIBUTION_PATH = path.join(DATA_DIR, 'benchmark-attribution.json');
export const DISCOVERY_QUEUE_PATH = path.join(DATA_DIR, 'discovery-pending.json');
export const RUN_REPORT_PATH = path.join(DATA_DIR, 'sync-report.json');
export const VENDOR_REGISTRY_PATH = path.join(ROOT, 'src', 'data', 'vendor-registry.ts');

export const ENDPOINTS = {
  modelsDevModels: 'https://models.dev/models.json',
  modelsDevApi: 'https://models.dev/api.json',
  epochBenchmarkZip: 'https://epoch.ai/data/benchmark_data.zip',
  openrouter: 'https://openrouter.ai/api/v1/models',
  vercelGateway: 'https://ai-gateway.vercel.sh/v1/models',
  litellm:
    'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json',
  huggingfaceModel: 'https://huggingface.co/api/models',
  /**
   * LiveBench v1 榜单。宽表 CSV + 分组定义 JSON，release 日期拼在文件名里。
   *
   * 2026-10 站点改版后，根路径变成 LiveBench 2.0 的单页应用，
   * `https://livebench.ai/table_<date>.csv` 会 404。官方前端改从 `/v1/` 取同一批文件，
   * 列名没变；`table_2026_06_25.csv` 比 github.io 仓库里 7 月的副本还多出一批型号。
   *
   * 2.0 在 `/data/<YYYYMMDD>/table.csv`，Coding 是单个 `coding` 列，
   * 不是 `code_generation` + `code_completion` 的平均，不能并进现有赛制。
   */
  liveBenchTable: (release: string) => `https://livebench.ai/v1/table_${release}.csv`,
  liveBenchCategories: (release: string) => `https://livebench.ai/v1/categories_${release}.json`,
  /** release 清单的权威出处是仓库里的 LIVE_BENCH_RELEASES 常量，抓不到时回落到内置清单。 */
  liveBenchReleasesSource:
    'https://raw.githubusercontent.com/LiveBench/LiveBench/main/livebench/common.py',
  /**
   * LMArena 官方榜单数据集（CC-BY 4.0）。走 Hugging Face 的 datasets-server，
   * 它直接返回 JSON，省掉引入 parquet 解析依赖。读的是权利人自己的发布，
   * 不是抓 arena.ai 的站，区别见 sources/lmarena.ts 顶部。
   */
  lmarenaRows: (config: string, offset: number, length: number) =>
    'https://datasets-server.huggingface.co/rows?dataset=lmarena-ai%2Fleaderboard-dataset' +
    `&config=${encodeURIComponent(config)}&split=latest&offset=${offset}&length=${length}`,
} as const;

/**
 * LiveBench 的 release 清单兜底值（实测 2026-09-01 全部返回 200）。
 * 正常路径是从上游仓库的 `LIVE_BENCH_RELEASES` 解析，这里只在解析失败时顶上——
 * 写死清单意味着新 release 不会被自动发现，与「发布后无人维护」的承诺相悖，
 * 所以它是兜底而不是主路径。
 */
export const LIVEBENCH_FALLBACK_RELEASES = [
  '2024-06-24', '2024-07-26', '2024-08-31', '2024-11-25', '2025-04-02', '2025-04-25',
  '2025-05-30', '2025-11-25', '2025-12-23', '2026-01-08', '2026-06-25',
];

export const HTTP = {
  timeoutMs: 60_000,
  retries: 2,
  retryDelayMs: 1_500,
  userAgent:
    'ai-model-world-sync/1.0 (+https://github.com/; contact via repo issues) node-fetch',
};

/** Hugging Face 是已知从中国大陆被 TCP reset 的域名，用更短的超时快速失败，避免拖慢整条管线。 */
export const HF = {
  timeoutMs: 8_000,
  retries: 0,
  concurrency: 4,
  /** 探针失败即整段跳过，不再对上百个仓库逐个超时。 */
  probeRepo: 'Qwen/Qwen3-235B-A22B',
};

/** 第二层容错：合理性校验闸门的阈值。任一不通过则拒绝写入并保留旧快照。 */
export const SANITY = {
  maxModelCountDropRatio: 0.1,
  maxCoverageDropRatio: 0.05,
  requiredFieldCoverageKeys: ['id', 'name', 'vendorId', 'contextWindow'] as const,
  /*
   * 承重字段：覆盖率本来就不高（ECI 只有四成模型有），所以不能用上面「跌 5 个百分点」的绝对规则，
   * 改比相对量——相对上一版跌掉超过一半就拒绝写入。
   *
   * 这条规则来自一次真实事故：2026-09-05 Epoch 把 ECI 的 CSV 挪进子目录并改名，
   * 解析器静默地一条都没接到，ECI 覆盖率 38% → 0%，而当时的闸门只盯着 id/name/上下文，放行了。
   * ECI 是全站排名、段位、「最聪明」的唯一依据，它塌了整个首页就是错的。
   */
  loadBearingKeys: ['benchmarks.eci', 'coding.任一编程成绩'] as const,
  maxLoadBearingRelativeDrop: 0.5,
};

/** 发布日期异常护栏：某源比其他源中位数早于该天数即判为异常值并丢弃。 */
export const RELEASE_DATE_OUTLIER_DAYS = 60;

/** 新模型晋升门槛：models.dev 之外的模型需要至少这么多个独立源同时出现才进入快照。 */
export const DISCOVERY_MIN_SOURCES = 2;
