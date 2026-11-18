/**
 * LiveBench 官方榜单（https://livebench.ai）。
 *
 * 许可证是本轮调研里最干净的一份：仓库 Apache-2.0，`docs/DATASHEET.md` 原文
 * 「There are no copyrights on the data.」
 *
 * > 仓库的 LICENSE 开头有一段 lm-sys/FastChat 的版权声明，别被它吓到：
 * > 那是**代码**血缘（LiveBench 沿用了 FastChat 的评测框架），
 * > 而题目与分数都是 LiveBench 自己跑的，与 LMArena 的众包投票数据无关，
 * > 不触发 LMArena 的 ToS。这一条与 lib/compliance.ts 里 LMArena 的判据不冲突：
 * > 那道判据看的是「分数是不是 LMArena 产的」，这里的分数不是。
 *
 * 两件必须做对的事，都不是显而易见的：
 *
 * 1. **CSV 是按 task 的宽表，没有现成的分组平均列。** 分组定义在
 *    `categories_<release>.json` 里，必须按它取平均，而且**每个 release 各取自己的定义**——
 *    task 列名换过（`LCB_generation`/`coding_completion` → `code_generation`/`code_completion`），
 *    写死列名会静默算错。
 *
 * 2. **不同 release 的分数不可比，必须按题目集同期分组。** 见 RELEASE_COHORTS。
 */
import { parse as parseCsv } from 'csv-parse/sync';

import { ENDPOINTS, LIVEBENCH_FALLBACK_RELEASES } from '../config';
import { fetchWithCache } from '../lib/http';
import { errorMessage, log } from '../lib/log';
import type { LiveBenchResult, LiveBenchScore } from './types';

/**
 * LiveBench 的题目集换代是**硬断点**，跨断点的分数绝不能进同一个赛制。
 *
 * 实测（2026-09-01，11 个 release 全量）：
 *   同一个模型跨 2025-04-02 ↔ 2025-04-25 这个断点，Coding 分中位数差 **27.6 分**、最大 41.9 分。
 *   典型样例 command-r-08-2024：6.1 → 26.1；claude-3-opus：38.6 → 23.3。
 *   而在断点之后的同期内，同一个模型跨 release 的差值中位 0.0、p90 1.4、**最大只有 5.1**。
 *   断点之前的那一代同期内部反而也很乱（中位 1.9、p90 26.3），所以那一代整体不用。
 *
 * 断点的判据不写死日期，而是看**这个 release 的 Coding 分组用的是哪套 task 名**——
 * 上游换题目集时同时换了 task 名，这是它自己留下的版本标记，比日期可靠。
 *
 * 结论：只采用 `code_generation` 那一代（2025-04-25 起）。代价是丢掉一批 2024 年的老模型，
 * 换来的是这个赛制内部真的可比。**宁可少一批模型，不要一个会随 release 抖动 40 分的档位。**
 */
const MODERN_CODING_TASKS = ['code_generation', 'code_completion'];

/** 分组名 → 我们的赛制 id。只取编程相关的两组，其余分组本管线不用。 */
const CATEGORY_LEAGUES: Array<{ category: string; league: string; note: string }> = [
  {
    category: 'Coding',
    league: 'livebench_coding',
    note: 'code_generation + code_completion 的算术平均，LeetCode / LiveCodeBench 风格的函数合成与补全',
  },
  {
    category: 'Agentic Coding',
    league: 'livebench_agentic_coding',
    note: 'javascript + typescript + python 的算术平均，仓库级真实任务。2025-05-30 起才有这一组',
  },
];

/**
 * LiveBench 的模型名带 reasoning-effort / thinking 后缀，是本源最大的归一化成本：
 *   `claude-opus-4-5-20251101-thinking-64k-high-effort`、`gpt-5.2-2025-12-11-nothinking`、
 *   `gemini-2.5-flash-lite-highthinking`、`grok-4-1-fast-non-reasoning`、`gpt-5.4-xhigh`
 *
 * 刻意**不含裸的 `-max`**：`qwen3.8-max`、`qwen3.7-max` 里的 max 是型号的一部分，
 * 剥掉就把旗舰型号变成了不存在的模型。只认 `-max-effort` 这种带 effort 的写法。
 * 这张表只在本模块用，不放进共享的 lib/ids.ts——那边被 Epoch 与 models.dev 共用，
 * 放宽它会影响另外两条链路的匹配。
 */
const EFFORT_SUFFIX =
  /-(base|thinking|no-?thinking|non-?reasoning|reasoning|auto|minimal|xhigh|high|medium|low|(?:high|medium|low)thinking|\d+k|(?:x?high|medium|low|max|minimal)-effort)$/i;

/**
 * LiveBench 还会把「月-年」形式的日期戳缀在型号后面（`gemini-3-pro-preview-11-2025`），
 * 而共享的 `slugVariants` 只认 `-YYYYMMDD` / `-YYYY-MM-DD` / `-MMDD` 这几种。
 * 这条规则只在本模块用——往共享的那张表里加 `-\d{2}$` 会误伤一批型号名。
 */
const MONTH_YEAR_SUFFIX = /-(?:0?[1-9]|1[0-2])-20\d{2}$/;

export function stripLiveBenchEffort(model: string): string {
  let s = model.trim().toLowerCase();
  for (let i = 0; i < 8; i += 1) {
    const n = s.replace(EFFORT_SUFFIX, '').replace(MONTH_YEAR_SUFFIX, '');
    if (n === s || n.length <= 2) break;
    s = n;
  }
  return s;
}

/** 从上游 `LIVE_BENCH_RELEASES = {"2024-07-26", ...}` 里抽出 release 清单。 */
export function parseLiveBenchReleases(pySource: string): string[] {
  const m = /LIVE_BENCH_RELEASES\s*=\s*\{([^}]*)\}/.exec(pySource);
  if (!m) return [];
  const out = new Set<string>();
  for (const hit of m[1].matchAll(/(\d{4})-(\d{2})-(\d{2})/g)) out.add(hit[0]);
  return [...out].sort();
}

/**
 * 分组平均。缺任何一个 task 就返回 null——半个分组的平均没有意义。
 *
 * **空串必须单独判掉**：`Number('')` 是 `0` 而且 `Number.isFinite(0)` 为真，
 * 只写 `isFinite` 检查的话，某个 task 没跑的行会被当成「这一项得 0 分」算进平均，
 * 把两项分组的分数直接砍半，而且不会报错。上游确实存在这种空值行。
 */
export function categoryAverage(
  row: Record<string, string>,
  tasks: string[],
): number | null {
  if (tasks.length === 0) return null;
  const vals: number[] = [];
  for (const t of tasks) {
    const raw = (row[t] ?? '').trim();
    if (raw === '') return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    vals.push(n);
  }
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
}

interface ReleasePayload {
  release: string;
  rows: Record<string, string>[];
  /** 分组名 → 这个 release 里实际存在的 task 列 */
  categories: Map<string, string[]>;
}

async function fetchRelease(release: string): Promise<ReleasePayload | null> {
  const key = release.replace(/-/g, '_');
  try {
    const [csv, cat] = await Promise.all([
      fetchWithCache(ENDPOINTS.liveBenchTable(key), { label: `livebench/table_${key}.csv` }),
      fetchWithCache(ENDPOINTS.liveBenchCategories(key), {
        label: `livebench/categories_${key}.json`,
      }),
    ]);
    const rows = parseCsv(csv.body.toString('utf8'), {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      bom: true,
      trim: false,
    }) as Record<string, string>[];
    if (rows.length === 0) return null;
    const groups = JSON.parse(cat.body.toString('utf8')) as Record<string, string[]>;
    const header = new Set(Object.keys(rows[0]));
    const categories = new Map<string, string[]>();
    for (const [name, tasks] of Object.entries(groups)) {
      if (!Array.isArray(tasks)) continue;
      categories.set(name, tasks.filter((t) => header.has(t)));
    }
    return { release, rows, categories };
  } catch (err) {
    log.warn(`LiveBench ${release} 抓取失败，跳过该 release：${errorMessage(err)}`);
    return null;
  }
}

export async function fetchLiveBench(fetchedAt: string): Promise<LiveBenchResult> {
  const byModel = new Map<string, LiveBenchScore[]>();
  const counts: Record<string, number> = {};
  const skippedReleases: string[] = [];

  let releases = LIVEBENCH_FALLBACK_RELEASES;
  let releaseSource = 'fallback';
  try {
    const res = await fetchWithCache(ENDPOINTS.liveBenchReleasesSource, {
      label: 'livebench/common.py',
    });
    const parsed = parseLiveBenchReleases(res.body.toString('utf8'));
    if (parsed.length > 0) {
      releases = parsed;
      releaseSource = 'LIVE_BENCH_RELEASES';
    }
  } catch (err) {
    log.warn(`LiveBench release 清单抓取失败，用内置兜底清单：${errorMessage(err)}`);
  }

  const payloads: ReleasePayload[] = [];
  for (const release of releases) {
    const p = await fetchRelease(release);
    if (!p) continue;
    // 断点判据：这个 release 的 Coding 分组用的是不是新一代 task 名。
    const coding = p.categories.get('Coding') ?? [];
    const modern = MODERN_CODING_TASKS.every((t) => coding.includes(t));
    if (!modern) {
      skippedReleases.push(release);
      continue;
    }
    payloads.push(p);
  }

  if (payloads.length === 0) {
    return {
      status: {
        ok: false,
        fetchedAt: null,
        note: `没有拿到任何可用 release（清单来源 ${releaseSource}，共 ${releases.length} 个）`,
      },
      byModel,
      counts,
      releasesUsed: [],
      releasesSkipped: skippedReleases,
      releaseSource,
    };
  }

  // 新 release 只重跑一部分模型，老模型的分数留在旧 release 里，
  // 所以要取同期内的并集；同一个模型出现在多个 release 时取**最新的那个**
  // （同期内实测最大只差 5.1 分，取最新是为了确定性而不是为了准确性）。
  payloads.sort((a, b) => (a.release < b.release ? 1 : -1));
  const releasesUsed = payloads.map((p) => p.release);

  for (const p of payloads) {
    for (const { category, league } of CATEGORY_LEAGUES) {
      const tasks = p.categories.get(category) ?? [];
      if (tasks.length === 0) continue;
      for (const row of p.rows) {
        const model = (row['model'] ?? '').trim();
        if (!model) continue;
        const score = categoryAverage(row, tasks);
        if (score === null) continue;
        const slug = stripLiveBenchEffort(model);
        if (!slug) continue;
        const list = byModel.get(slug) ?? [];
        // 同一模型同一赛制只留最新 release 的那条；payloads 已按 release 降序，
        // 所以先写入的就是最新的，后面的直接跳过。
        if (list.some((s) => s.league === league)) continue;
        list.push({
          league,
          score,
          release: p.release,
          upstreamModel: model,
          // 榜单页走 hash 路由，打开的是这一期 v1 表，而不是首页上的 2.0。
          sourceUrl: `https://livebench.ai/#/release/${p.release}`,
        });
        byModel.set(slug, list);
        counts[league] = (counts[league] ?? 0) + 1;
      }
    }
  }

  log.step(
    `LiveBench：release 清单来自 ${releaseSource}（${releases.length} 个），` +
      `采用同期 ${releasesUsed.length} 个（${releasesUsed[releasesUsed.length - 1]} ~ ${releasesUsed[0]}），` +
      `因题目集换代跳过 ${skippedReleases.length} 个；` +
      `归一后 ${byModel.size} 个模型名，` +
      Object.entries(counts)
        .map(([k, v]) => `${k} ${v}`)
        .join(' · '),
  );

  return {
    status: {
      ok: true,
      fetchedAt,
      note:
        `Apache-2.0 / DATASHEET 明文「no copyrights on the data」。` +
        `采用 ${releasesUsed.length} 个同期 release（${releasesUsed.join(', ')}）；` +
        `跳过题目集换代前的 ${skippedReleases.length} 个（${skippedReleases.join(', ')}）——` +
        `实测跨这个断点同一模型的 Coding 分中位差 27.6 分，不可同池。`,
    },
    byModel,
    counts,
    releasesUsed,
    releasesSkipped: skippedReleases,
    releaseSource,
  };
}
