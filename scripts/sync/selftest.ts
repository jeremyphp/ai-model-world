/**
 * 管线自检：不联网，只验证那些「错了也不会报错、只会静默产出脏数据」的纯函数。
 *
 *   npx tsx scripts/sync/selftest.ts
 *
 * 覆盖调研报告里点名的每一个坑：单位归一化、YYYY-MM 日期、发布日期的两个实测反例、
 * Artificial Analysis 字段剔除、闭源模型不得标 exact、以及合理性校验闸门本身。
 */
import { arenaMatchCandidates, arenaNameKeys } from './sources/lmarena';
import {
  classifyEpochFile,
  findArtificialAnalysisLeaks,
  findBlockedBenchmarkSources,
  isArtificialAnalysisSourced,
  stripArtificialAnalysis,
} from './lib/compliance';
import { parseLooseDate } from './lib/dates';
import { perMTokAsIs, perTokenToPerMTok, sanitizePrice } from './lib/decimal';
import {
  canonicalizeId,
  hasParamToken,
  paramStrippedVariants,
  slugVariants,
  stripEffortSuffix,
  toSlug,
} from './lib/ids';
import { stableStringify } from './lib/stable-json';
import { normalizeLicense } from './merge/license';
import { paramsFromSlug, resolveParams, synthesizeSizeTier } from './merge/params';
import { arbitrateReleaseDate } from './merge/release-date';
import { shouldPromoteDiscovery, stripServiceTierSuffix } from './merge/build';
import {
  leagueIdFromFile,
  lookupEpochLeagueScores,
  lookupEpochParamStripped,
  lookupEpochTrainingCompute,
  pctMultiplierFromScale,
} from './sources/epoch';
import { pickLiteLlmField } from './sources/litellm';
import {
  categoryAverage,
  parseLiveBenchReleases,
  stripLiveBenchEffort,
} from './sources/livebench';
import type { EpochAggregate, EpochResult } from './sources/types';
import {
  attributionOf,
  beatsPrevious,
  codingLeagueRank,
  normalizeBenchmarkName,
  pickCodingLeague,
} from './sources/models-dev';
import { validateSnapshot } from './validate';
import { diffSnapshots } from './lib/changelog';
import { buildPriceRadar } from '../../src/lib/welfare';
import type { BenchmarkScore, ModelRecord, WorldSnapshot } from '../../src/lib/types';

let passed = 0;
const failures: string[] = [];

function check(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed += 1;
  } else {
    failures.push(`${name}\n    期望 ${e}\n    实际 ${a}`);
  }
}

// ── 单位归一化 ────────────────────────────────────────────────────────
check('OpenRouter 字符串 $/token → $/Mtok', perTokenToPerMTok('0.000005'), 5);
check('Vercel 字符串 $/token → $/Mtok', perTokenToPerMTok('0.00000012'), 0.12);
check('LiteLLM 科学计数法 5E-7', perTokenToPerMTok('5E-7'), 0.5);
check('LiteLLM number 5e-7', perTokenToPerMTok(5e-7), 0.5);
check('OpenRouter 三位有效数字不产生浮点尾巴', perTokenToPerMTok('0.000000834'), 0.834);
check('models.dev 已经是 $/Mtok', perMTokAsIs(2.5), 2.5);
check('负价格判非法', sanitizePrice(-1), null);
check('零价格判非法', sanitizePrice(0), null);
// 这三条是本模块存在的理由：直接 float 相乘会得到
// 2e-7 * 1e6 = 0.19999999999999998、0.0000032 * 1e6 = 3.1999999999999997
// （都是 LiteLLM 里真实存在的值），脏数字会一路写进 data/models.json。
check('LiteLLM ai21 输入价不产生浮点尾巴', perTokenToPerMTok(2e-7), 0.2);
check('LiteLLM nova-pro 输出价不产生浮点尾巴', perTokenToPerMTok(0.0000032), 3.2);
check('float 直乘确实会出错（反证）', 2e-7 * 1e6 === 0.2, false);

// ── 宽松日期 ──────────────────────────────────────────────────────────
check('YYYY-MM-DD', parseLooseDate('2026-08-28'), { iso: '2026-08-28', precision: 'day' });
check('YYYY-MM（models.dev 的 9 条）', parseLooseDate('2026-01'), {
  iso: '2026-01-01',
  precision: 'month',
});
check('YYYY', parseLooseDate('2025'), { iso: '2025-01-01', precision: 'year' });
check('Unix 秒（OpenRouter created）', parseLooseDate(1787897375), {
  iso: '2026-08-28',
  precision: 'day',
});
check('带时间的 ISO 只取日期', parseLooseDate('2026-08-30T22:42:14.000Z'), {
  iso: '2026-08-30',
  precision: 'day',
});
check('非法日期返回 null', parseLooseDate('2026-13-45'), null);
check('空串返回 null', parseLooseDate(''), null);

// ── 发布日期仲裁：调研里的两个实测反例 ──────────────────────────────────
const seed = arbitrateReleaseDate([
  { source: 'models.dev', value: { iso: '2026-02-14', precision: 'day' }, anchor: true },
  { source: 'openrouter', value: { iso: '2026-08-12', precision: 'day' }, anchor: false },
]);
check('seed-2.0-code：OpenRouter 晚 179 天，应取 models.dev', seed?.value.iso, '2026-02-14');

const qwenCoder = arbitrateReleaseDate([
  { source: 'models.dev', value: { iso: '2026-02-03', precision: 'day' }, anchor: true },
  { source: 'vercel-gateway', value: { iso: '2025-07-22', precision: 'day' }, anchor: false },
]);
check('qwen3-coder-next：Vercel 早 196 天是错值，应丢弃', qwenCoder?.value.iso, '2026-02-03');
check(
  'qwen3-coder-next：异常值被标记为 dropped',
  qwenCoder?.candidates.find((c) => c.source === 'vercel-gateway')?.dropped,
  true,
);

const withinGuard = arbitrateReleaseDate([
  { source: 'models.dev', value: { iso: '2026-04-24', precision: 'day' }, anchor: true },
  { source: 'vercel-gateway', value: { iso: '2026-04-23', precision: 'day' }, anchor: false },
]);
check('护栏内的更早日期应被采纳（取 min）', withinGuard?.value.iso, '2026-04-23');

const noAnchor = arbitrateReleaseDate([
  { source: 'openrouter', value: { iso: '2026-05-01', precision: 'day' }, anchor: false },
  { source: 'vercel-gateway', value: { iso: '2026-04-28', precision: 'day' }, anchor: false },
]);
check('没有锚点源时退回取 min', noAnchor?.value.iso, '2026-04-28');
check('单一候选原样返回', arbitrateReleaseDate([
  { source: 'openrouter', value: { iso: '2026-01-05', precision: 'day' }, anchor: false },
])?.source, 'openrouter');
check('无候选返回 null', arbitrateReleaseDate([]), null);

// ── id 归一 ───────────────────────────────────────────────────────────
check('OpenRouter 的 qwen 命名空间归到 alibaba', canonicalizeId('qwen/qwen3.8-flash')?.id, 'alibaba/qwen3.8-flash');
check('z-ai 归到 zhipuai', canonicalizeId('z-ai/glm-5.3')?.id, 'zhipuai/glm-5.3');
check(':free 变体被剥掉', canonicalizeId('inclusionai/ling-3.0-flash-fin:free')?.variant, 'free');
check('~ 动态别名被识别', canonicalizeId('~z-ai/glm-latest')?.variant, 'alias');
check('Vercel 的 owned_by 兜底', canonicalizeId('qwen-3-14b', 'alibaba')?.id, 'alibaba/qwen-3-14b');
check('Epoch 的 _max 后缀被剥掉', stripEffortSuffix('glm-5.2_max'), 'glm-5.2');
check('型号自带的 -max 不能被剥掉', stripEffortSuffix('qwen3.7-max'), 'qwen3.7-max');
check('日期戳逐级剥离', slugVariants('claude-3-opus-20240229').includes('claude3opus'), true);
// Epoch 新版 eci_scores.csv 只有空格分词的展示名，后缀剥离对它也得生效
check('展示名的空格后缀也能剥离', slugVariants('Grok 4.3 Beta').includes('grok43'), true);
check('展示名的空格日期戳也能剥离', slugVariants('DeepSeek V3 0324').includes('deepseekv3'), true);

/*
 * slug 里不能留点。Next 的 trailingSlash 见到末段含点就当文件名、不补斜杠，
 * 链接变成 /model/xxx-2.5-72b 而文件在 .../index.html，
 * 不做重定向的对象存储上就是 404。全站 39% 的模型 slug 带点，别改回去。
 */
check('slug 的点转成连字符', toSlug('alibaba/qwen-2.5-72b-instruct'), 'alibaba-qwen-2-5-72b-instruct');
check('slug 不残留任何点', toSlug('a/b2.5.1-c').includes('.'), false);

/*
 * ── 竞技场名称匹配 ───────────────────────────────────────────────────
 *
 * 这几条锁的是 2026-09-20 接入 LMArena 时踩的两个点。
 *
 * 一是上游与站内各挂各的配置后缀，不剥就对不上：上游 `veo-3.1-audio`、
 * `gpt-image-1.5-high-fidelity`，站内 `veo-3.1-generate-preview`。
 * 实测不剥的话图像视频模型只能匹配三分之一。
 *
 * 二是**剥过头比不剥更糟**。`fast` / `lite` / `pro` 是同族不同型号的区分位，
 * 一旦被当成配置词剥掉，`veo-3.1-fast` 会跟 `veo-3.1` 撞成一个，两个型号的分数就串了。
 * 下面第三、四条就是拦这个的。
 */
check(
  '竞技场名剥掉配置后缀',
  arenaNameKeys('veo-3.1-audio').includes('veo31'),
  true,
);
check(
  '括号里的通行名也要注册',
  arenaNameKeys('gemini-3-pro-image-2k (nano-banana-pro)').includes('nanobananapro'),
  true,
);
check(
  'fast 是型号区分位，不能被剥掉',
  arenaNameKeys('veo-3.1-fast-audio').includes('veo31'),
  false,
);
check(
  'lite 同理',
  arenaNameKeys('gemini-3.1-flash-lite-image (nano-banana-2-lite)').includes('nanobanana2'),
  false,
);
check(
  '站内名的 preview / generate 后缀也要剥',
  arenaMatchCandidates(['veo-3.1-generate-preview']).includes('veo31'),
  true,
);

// ── 许可证 SPDX 归一 ──────────────────────────────────────────────────
check('MIT License → MIT', normalizeLicense('MIT License'), 'MIT');
check('Apache 2.0 → Apache-2.0', normalizeLicense('Apache 2.0'), 'Apache-2.0');
check('OpenMDW-1.1 原样保留', normalizeLicense('OpenMDW-1.1'), 'OpenMDW-1.1');
check('厂商自定义许可 → LicenseRef-*', normalizeLicense('DeepSeek Model License'), 'LicenseRef-DeepSeek-Model');
// models.dev 实测把模型 id 写进了 license 字段
check('脏值 "qwen3.8-max" 判为不可用', normalizeLicense('qwen3.8-max'), null);
check('空值返回 null 而不是猜测', normalizeLicense(null), null);

// ── 参数量 ────────────────────────────────────────────────────────────
check('MoE 总参+激活参', paramsFromSlug('qwen3-235b-a22b'), { totalB: 235, activeB: 22 });
check('T 量级', paramsFromSlug('qwen3.8-2.4t-a95b'), { totalB: 2400, activeB: 95 });
check('单一总参', paramsFromSlug('gemma-3-27b-it'), { totalB: 27, activeB: null });
check('小模型', paramsFromSlug('qwen3-0.6b'), { totalB: 0.6, activeB: null });
check('Llama 4 的 17B-128E 只算激活参', paramsFromSlug('llama-4-scout-17b-16e-instruct'), {
  totalB: null,
  activeB: 17,
});
check('型号里没有参数量就不猜', paramsFromSlug('claude-opus-5'), { totalB: null, activeB: null });
check('gpt-4-32k 的 32k 不是参数量', paramsFromSlug('gpt-4-32k'), { totalB: null, activeB: null });
check('闭源旗舰 → 5 档', synthesizeSizeTier('claude-opus-5', 25)?.tier, 5);
check('闭源小杯 → 1 档', synthesizeSizeTier('gemini-3.7-flash', 0.6)?.tier, 1);
check('无价无命名信号 → null', synthesizeSizeTier('some-model', null), null);

// ── confidence 三档语义 ──────────────────────────────────────────────
// HF 可达时（境外节点 / GitHub Actions）必须产出 exact——本地拿不到 HF，
// 所以用一条注入的 HF 结果证明这条分支是通的。
check(
  'HF 有 safetensors → exact',
  resolveParams({
    modelSlug: 'qwen3-235b-a22b',
    hfTotalB: 235.09,
    hfActiveB: null,
    openWeights: true,
    outputPerMTok: 6,
  }),
  {
    totalB: 235.09,
    activeB: 22,
    confidence: 'exact',
    tier: null,
    totalSource: 'huggingface',
    activeSource: 'derived',
  },
);
check(
  'HF 不可达但型号名自带参数量 → estimated（型号名是营销串，不是测量值）',
  resolveParams({
    modelSlug: 'qwen3-235b-a22b',
    hfTotalB: null,
    hfActiveB: null,
    openWeights: true,
    outputPerMTok: 6,
  }).confidence,
  'estimated',
);
check(
  '开源 + HF 不可达 + 型号名无参数量 → unknown（不拿价格档位冒充）',
  resolveParams({
    modelSlug: 'deepseek-v4-pro',
    hfTotalB: null,
    hfActiveB: null,
    openWeights: true,
    outputPerMTok: 0.87,
  }),
  {
    totalB: null,
    activeB: null,
    confidence: 'unknown',
    tier: null,
    totalSource: null,
    activeSource: null,
  },
);
check(
  '闭源 → 只给 1–5 档规模，confidence=estimated 而 totalB 仍为 null',
  resolveParams({
    modelSlug: 'claude-opus-5',
    hfTotalB: null,
    hfActiveB: null,
    openWeights: false,
    outputPerMTok: 25,
  }),
  {
    totalB: null,
    activeB: null,
    confidence: 'estimated',
    tier: { tier: 5, basis: 'price+naming' },
    totalSource: null,
    activeSource: null,
  },
);
check(
  '闭源且无任何信号 → unknown',
  resolveParams({
    modelSlug: 'mystery-model',
    hfTotalB: null,
    hfActiveB: null,
    openWeights: false,
    outputPerMTok: null,
  }).confidence,
  'unknown',
);

// ── Artificial Analysis 剔除 ─────────────────────────────────────────
const orPayload = {
  data: [
    {
      id: 'x/y',
      benchmarks: {
        design_arena: [],
        artificial_analysis: { intelligence_index: 57.5, coding_index: 71.5 },
      },
    },
  ],
};
const strippedResult = stripArtificialAnalysis(orPayload);
check('AA 子字段被剔除', JSON.stringify(strippedResult.data).includes('artificial_analysis'), false);
check('AA 指标值一并消失', JSON.stringify(strippedResult.data).includes('intelligence_index'), false);
check('剔除计数正确', strippedResult.stripped, 1);
check(
  '同级的非 AA 字段保留',
  JSON.stringify(strippedResult.data).includes('design_arena'),
  true,
);

// models.dev 的 benchmarks[] 是第二条渗入路径，而且名字往往是中性的，
// 只按名字过滤会漏掉 70 条实测来自 artificialanalysis.ai 的成绩。
check('按名字拦：Artificial Analysis Coding Index', isArtificialAnalysisSourced('Artificial Analysis Coding Index', 'https://openai.com/x'), true);
check('按名字拦：GDPval-AA', isArtificialAnalysisSourced('GDPval-AA', 'https://x.ai/news'), true);
check(
  '按来源拦：名字中性但 source 指向 AA',
  isArtificialAnalysisSourced('SWE-Bench Pro', 'https://artificialanalysis.ai/agents/coding-agents'),
  true,
);
check(
  '正常的厂商自报成绩放行',
  isArtificialAnalysisSourced('SWE-Bench Verified', 'https://huggingface.co/tencent/Hy3'),
  false,
);
check(
  '正常的第三方榜单放行',
  isArtificialAnalysisSourced('SWE-Bench Pro', 'https://labs.scale.com/leaderboard'),
  false,
);
check('source 缺失时按名字判定', isArtificialAnalysisSourced('Terminal-Bench', null), false);
check(
  '泄漏探测器能抓到残留',
  findArtificialAnalysisLeaks({ a: { source: 'https://artificialanalysis.ai/x' } }).length > 0,
  true,
);
check('干净数据不误报', findArtificialAnalysisLeaks({ a: { source: 'https://epoch.ai/x' } }), []);

// ── 榜单名归一 ────────────────────────────────────────────────────────
// 上游同一个榜单有好几种写法，归一错了就等于把一个赛制拆成两个，
// 分位数分母被腰斩，档位随之失真——而且不会报错。
check('连字符与空格等价', normalizeBenchmarkName('SWE-Bench Pro'), 'swe bench pro');
check('大小写与多余空格', normalizeBenchmarkName('  Terminal-Bench   2.1 '), 'terminal bench 2.1');
check('下划线也当分隔符', normalizeBenchmarkName('swe_bench_verified'), 'swe bench verified');
check('弯撇号归一成直角撇号', normalizeBenchmarkName('Humanity’s Last Exam'), "humanity's last exam");

// ── 编程赛制白名单 ────────────────────────────────────────────────────
check('SWE-bench Pro 是编程赛制', pickCodingLeague('SWE-Bench Pro'), 'swe_bench_pro');
check('Aider Polyglot 是编程赛制', pickCodingLeague('Aider Polyglot'), 'aider_polyglot');
check('Terminal-Bench 2.1 与主榜分列', pickCodingLeague('Terminal-Bench 2.1'), 'terminal_bench_2_1');
check('ClawEval 的两种拼法归到同一赛制', pickCodingLeague('ClawEval'), pickCodingLeague('Claw Eval'));
// models.dev 转载的 Verified 与 Epoch 统一复跑的必须分属两个赛制，
// 否则前端会把「各家自己搭的脚手架」和「同一套脚手架复跑」放进同一个分位池。
check(
  'models.dev 的 SWE-bench Verified 出口改名成 swe_bench_vendor',
  pickCodingLeague('SWE-Bench Verified'),
  'swe_bench_vendor',
);
// 口径判断：这几条是人工裁定的结果，理由写在 CODING_LEAGUES 上方。改动前先读那段。
check('SciCode 不是软件工程口径，不收', pickCodingLeague('SciCode'), null);
check('AutomationBench 是工作流自动化，不收', pickCodingLeague('AutomationBench'), null);
check('GPQA Diamond 显然不是编程', pickCodingLeague('GPQA Diamond'), null);
check('厂商自造的单点评测不收', pickCodingLeague('Kimi Code Bench'), null);
check('Terminal-Bench Hard 口径合格（数据会被合规拦掉，但赛制登记着）', pickCodingLeague('Terminal-Bench Hard'), 'terminal_bench_hard');

// 赛制排序：Epoch 复跑 > 自报 Verified > Pro > …… > Elo 垫底
check('Epoch 复跑排最前', codingLeagueRank('swe_bench_verified'), 0);
check('自报 Verified 紧随其后', codingLeagueRank('swe_bench_vendor'), 1);
check(
  'WebDev Arena Elo 排在所有百分数赛制之后',
  codingLeagueRank('webdev_arena_elo') > codingLeagueRank('swe_bench_pro'),
  true,
);
check(
  '未登记的赛制排在所有已登记赛制之后',
  codingLeagueRank('some_new_bench') >= codingLeagueRank('webdev_arena_elo'),
  true,
);

// ── attribution 判定 ─────────────────────────────────────────────────
check('Scale 官方榜是第三方', attributionOf('https://labs.scale.com/leaderboard/swe_bench_pro_public'), 'third-party');
check('aider.chat 官方榜是第三方', attributionOf('https://aider.chat/docs/leaderboards/'), 'third-party');
check('厂商系统卡是自报', attributionOf('https://huggingface.co/tencent/Hy3'), 'vendor-self-reported');
check('厂商官网是自报', attributionOf('https://www.anthropic.com/news/claude-opus-4-8'), 'vendor-self-reported');
check('没有来源时保守判成自报', attributionOf(null), 'vendor-self-reported');
// 厂商自己发的预印本仍然是自报，署名换了个地方而已。
check('arxiv 上的厂商论文仍算自报', attributionOf('https://arxiv.org/abs/2602.10604'), 'vendor-self-reported');

// ── 同赛制多条时的取舍 ────────────────────────────────────────────────
function vb(over: Partial<import('./sources/types').VendorBenchmark> = {}) {
  return {
    key: 'swe_bench_pro',
    league: 'swe_bench_pro',
    rawName: 'SWE-Bench Pro',
    score: 50,
    metric: 'resolve rate',
    sourceHost: 'labs.scale.com',
    sourceUrl: 'https://labs.scale.com/leaderboard',
    attributionType: 'third-party' as const,
    ...over,
  };
}
// 这一条是本模块存在的理由：实测同一列 SWE-Bench Pro 里，
// Scale 官方榜中位数 41.0 而厂商自评中位数 59.0，差 18 分。
// 「分高者胜」会系统性地把自评顶上去，所以第三方必须先于分数。
check(
  '第三方胜过厂商自评，哪怕自评分数更高',
  beatsPrevious(
    vb({ score: 41, attributionType: 'third-party', sourceHost: 'labs.scale.com' }),
    vb({ score: 59, attributionType: 'vendor-self-reported', sourceHost: 'x.ai' }),
  ),
  true,
);
check(
  '厂商自评不能靠高分挤掉第三方',
  beatsPrevious(
    vb({ score: 59, attributionType: 'vendor-self-reported', sourceHost: 'x.ai' }),
    vb({ score: 41, attributionType: 'third-party', sourceHost: 'labs.scale.com' }),
  ),
  false,
);
check('同类来源里取高分', beatsPrevious(vb({ score: 60 }), vb({ score: 50 })), true);
check('同类来源里低分不覆盖', beatsPrevious(vb({ score: 40 }), vb({ score: 50 })), false);
check(
  '分数并列时按来源域名字典序，不依赖上游数组顺序',
  beatsPrevious(vb({ sourceHost: 'aider.chat' }), vb({ sourceHost: 'labs.scale.com' })),
  true,
);

// ── Artificial Analysis 第三跳：openrouter.ai ──────────────────────────
// 判定依据见 lib/compliance.ts。这三条是那段论证的可执行版本。
check(
  'openrouter.ai 的成绩按 AA 拦截（名字完全中性也拦）',
  isArtificialAnalysisSourced('Terminal-Bench Hard', 'https://openrouter.ai/openai/gpt-5-codex/benchmarks'),
  true,
);
check(
  'openrouter.ai 上的 SciCode 同样拦掉',
  isArtificialAnalysisSourced('SciCode', 'https://openrouter.ai/google/gemini-2.5-pro/benchmarks'),
  true,
);
check(
  '同一域名上那个自己承认身份的也拦掉',
  isArtificialAnalysisSourced('Artificial Analysis Coding Index', 'https://openrouter.ai/x/y/benchmarks'),
  true,
);
check(
  'openrouter 只是发现源，不影响非成绩场景（这里只判成绩来源）',
  isArtificialAnalysisSourced('SWE-Bench Verified', 'https://swebench.com/'),
  false,
);
// 字段级兜底扫描：coding[].sourceUrl 才是判据，vendors[].homepage 里的 openrouter.ai 是合法的。
check(
  '字段级扫描抓到 openrouter.ai 来源的编程成绩',
  findBlockedBenchmarkSources([
    { id: 'v/m', coding: [{ league: 'terminal_bench_hard', sourceUrl: 'https://openrouter.ai/a/b/benchmarks' }] },
  ]).length,
  1,
);
check(
  '字段级扫描不误伤厂商主页',
  findBlockedBenchmarkSources([
    { id: 'v/m', coding: [{ league: 'swe_bench_pro', sourceUrl: 'https://labs.scale.com/x' }] },
  ]),
  [],
);
check(
  '历史快照没有 coding 字段时字段级扫描不炸',
  findBlockedBenchmarkSources([{ id: 'v/m' }]),
  [],
);

// ── Epoch 去参数量兜底的两道守卫 ───────────────────────────────────────
// 不带守卫直接放进匹配阶梯实测是 1 对 2 错，详见 lib/ids.ts 的论证。
check(
  '带权重的 slug 能剥出营销名',
  paramStrippedVariants('nemotron-3-ultra-550b-a55b').includes('nemotron3ultra'),
  true,
);
check(
  '展示名用空格分隔也能剥',
  paramStrippedVariants('Nemotron 3 Ultra 550B A55B').includes('nemotron3ultra'),
  true,
);
check('先剥 -it 再剥参数量', paramStrippedVariants('gemma-3-27b-it').includes('gemma3'), true);
check('没有参数量后缀时不产出任何候选', paramStrippedVariants('claude-opus-5'), []);
check('版本号不是参数量，不许剥', paramStrippedVariants('muse-spark-1.2'), []);
// 守卫一：上游标识自己带了规模，就绝不许走去参数量兜底。
check('Llama 3.1-405B 自带规模', hasParamToken('Llama 3.1-405B'), true);
check('Qwen2.5-Coder (1.5B) 自带规模', hasParamToken('Qwen2.5-Coder (1.5B)'), true);
check('gemma-3-1b-it 自带规模', hasParamToken('gemma-3-1b-it'), true);
check('Nemotron 3 Ultra 不带规模', hasParamToken('Nemotron 3 Ultra'), false);
// 「Grok 3 mini」里的「3 m」不是 3 百万参数——右边界没写对就会误判。
check('Grok 3 mini 不算自带规模', hasParamToken('Grok 3 mini'), false);
check('MiniMax-M1-80k 的 80k 不是参数量', hasParamToken('MiniMax-M1-80k'), false);
check('o3-2025-04-16 的日期不是参数量', hasParamToken('o3-2025-04-16'), false);
// 守卫二的素材：这两个键会在 build.ts 里因为多个模型撞在一起而作废。
check(
  '70B 与 8B 剥完撞在同一个键上（build.ts 据此作废该键）',
  paramStrippedVariants('llama-3.1-70b')[0] === paramStrippedVariants('llama-3.1-8b')[0],
  true,
);

// 兜底查表本身的两道守卫。这四条是「1 对 2 错」那组实测反例的固化版本。
function epochFixture(over: Partial<EpochResult> = {}): EpochResult {
  return {
    status: { ok: true, fetchedAt: null },
    strict: new Map(),
    loose: new Map(),
    unsized: new Map(),
    unsizedAliasOwners: new Map(),
    entities: new Map(),
    aliasOwners: new Map(),
    vendorCountry: new Map(),
    counts: {},
    codingStrict: new Map(),
    codingLoose: new Map(),
    codingUnsized: new Map(),
    codingCounts: {},
    blockedFiles: [],
    exemptFiles: [],
    skippedFiles: [],
    leagues: {},
    leagueStrict: new Map(),
    leagueLoose: new Map(),
    leagueUnsized: new Map(),
    trainingComputeStrict: new Map(),
    trainingComputeLoose: new Map(),
    trainingComputeRows: 0,
    ...over,
  };
}
const agg = (scores: Record<string, number>): EpochAggregate => ({
  scores: scores as EpochAggregate['scores'],
  releaseDate: null,
  organization: 'NVIDIA',
  country: 'US',
});
check(
  '守卫齐备时兜底能查到（Nemotron 3 Ultra 那一例）',
  lookupEpochParamStripped(
    epochFixture({
      unsized: new Map([['nvidia|nemotron3ultra', agg({ eci: 143.11 })]]),
      unsizedAliasOwners: new Map([['nvidia|nemotron3ultra', new Set(['nvidia|nemotron3ultra'])]]),
    }),
    'nvidia',
    ['nemotron3ultra'],
  )?.aggregate.scores.eci,
  143.11,
);
check(
  '上游同一个别名键被多个实体注册时拒绝（几代取 max 的聚合值谁都不配拿）',
  lookupEpochParamStripped(
    epochFixture({
      unsized: new Map([['mistral|mistralsmall', agg({ eci: 127.71 })]]),
      unsizedAliasOwners: new Map([
        ['mistral|mistralsmall', new Set(['mistral|mistralsmall3', 'mistral|mistralsmall32'])],
      ]),
    }),
    'mistral',
    ['mistralsmall'],
  ),
  null,
);
check(
  '命中的实体没有任何分数时拒绝（没收益，只会污染发布日期锚点）',
  lookupEpochParamStripped(
    epochFixture({
      unsized: new Map([['mistral|codestral', agg({})]]),
      unsizedAliasOwners: new Map([['mistral|codestral', new Set(['mistral|codestral'])]]),
    }),
    'mistral',
    ['codestral'],
  ),
  null,
);
check(
  '带规模标记的上游条目压根不进 unsized 索引，因此查不到',
  lookupEpochParamStripped(epochFixture(), 'meta', ['llama31']),
  null,
);

// ── Epoch 全榜单泛化接入 ───────────────────────────────────────────────
// league id 是契约：文件名去 .csv 与 _external，手写规格的旧 id 通过别名表对齐。
check('external 后缀被剥掉', leagueIdFromFile('hle_external.csv'), 'hle');
check('Epoch 自测榜没有后缀', leagueIdFromFile('frontiermath_tiers_1_3_v2.csv'), 'frontiermath_tiers_1_3_v2');
check('手写规格的旧 id 通过别名表对齐（terminalbench → terminal_bench_2_0）', leagueIdFromFile('terminalbench_external.csv'), 'terminal_bench_2_0');
check('ECI 的别名', leagueIdFromFile('epoch_capabilities_index.csv'), 'eci');
check('带目录的路径只看文件名', leagueIdFromFile('sub/dir/gpqa_diamond.csv'), 'gpqa_diamond');
// metadata 的 scale：原始值 × scale = 0–1 归一分，再 × 100 才是本站的百分数。
check('scale 1.0（本来就是小数）→ ×100', pctMultiplierFromScale(1), 100);
check('scale 0.01（本来是 0–100）→ ×1', pctMultiplierFromScale(0.01), 1);
check('scale 0.1（本来是 0–10）→ ×10', pctMultiplierFromScale(0.1), 10);
// 全榜单索引与编程索引分开，逐档累加、严格档先写入。
const leagueFixture = epochFixture({
  leagueStrict: new Map([
    ['openai|gpt5', { hle: { league: 'hle', score: 25.1, unit: 'pct', sourceUrl: null } }],
  ]),
  leagueLoose: new Map([
    [
      'openai|gpt5',
      {
        hle: { league: 'hle', score: 30, unit: 'pct', sourceUrl: null },
        metr_time_horizons: { league: 'metr_time_horizons', score: 352.25, unit: 'minutes', sourceUrl: null },
      },
    ],
  ]),
});
const leagueHit = lookupEpochLeagueScores(leagueFixture, 'openai', ['gpt5'], []);
check('严格档先写入、宽松档不覆盖同一 league', leagueHit.hle?.score, 25.1);
check('宽松档补上严格档没有的 league', leagueHit.metr_time_horizons?.unit, 'minutes');
check('厂商不对就什么都查不到', lookupEpochLeagueScores(leagueFixture, 'google', ['gpt5'], []), {});
// 训练算力：已匹配的别名键优先；键上登记为 null（几代模型冲突）视同没有。
const flopFixture = epochFixture({
  trainingComputeStrict: new Map([['google|gemini3flash', null]]),
  trainingComputeLoose: new Map([
    ['google|gemini3flash', null],
    ['google|gemini3flashpreview', 1.2e25],
  ]),
});
check('别名键冲突记 null，不猜', lookupEpochTrainingCompute(flopFixture, 'google', ['gemini3flash'], null), null);
check('已匹配的别名键优先', lookupEpochTrainingCompute(flopFixture, 'google', ['gemini3flash'], 'google|gemini3flashpreview'), 1.2e25);
check('阶梯能走到宽松档', lookupEpochTrainingCompute(flopFixture, 'google', ['nothing', 'gemini3flashpreview'], null), 1.2e25);
check('没有条目返回 null', lookupEpochTrainingCompute(flopFixture, 'openai', ['gpt5'], null), null);

// ── 注册厂商单源快速晋升 ───────────────────────────────────────────────
check('models.dev 收录的直接晋升', shouldPromoteDiscovery({ inModelsDev: true, sources: [], vendorRegistered: false, serviceTierAlias: false }).via, 'models.dev');
check('两个网关源佐证的晋升', shouldPromoteDiscovery({ inModelsDev: false, sources: ['openrouter', 'vercel-gateway'], vendorRegistered: false, serviceTierAlias: false }).via, 'multi-source');
check('未登记厂商单源不晋升', shouldPromoteDiscovery({ inModelsDev: false, sources: ['openrouter'], vendorRegistered: false, serviceTierAlias: false }).promote, false);
check('登记厂商 openrouter 单源即晋升', shouldPromoteDiscovery({ inModelsDev: false, sources: ['openrouter'], vendorRegistered: true, serviceTierAlias: false }).via, 'registered-vendor');
check('登记厂商 vercel 单源即晋升', shouldPromoteDiscovery({ inModelsDev: false, sources: ['vercel-gateway'], vendorRegistered: true, serviceTierAlias: false }).via, 'registered-vendor');
check('登记厂商但只有 litellm 一源不算', shouldPromoteDiscovery({ inModelsDev: false, sources: ['litellm'], vendorRegistered: true, serviceTierAlias: false }).promote, false);
check('登记厂商零源当然不晋升', shouldPromoteDiscovery({ inModelsDev: false, sources: [], vendorRegistered: true, serviceTierAlias: false }).promote, false);
// 服务档位别名不是新模型。第一次实跑 62 个「新模型」里 30 个是 gpt-5-fast 这种，守卫由此而来。
check('服务档位别名不许走快速晋升', shouldPromoteDiscovery({ inModelsDev: false, sources: ['vercel-gateway'], vendorRegistered: true, serviceTierAlias: true }).promote, false);
check('别名若有两个源佐证仍按多源规则晋升（不改旧规则）', shouldPromoteDiscovery({ inModelsDev: false, sources: ['openrouter', 'vercel-gateway'], vendorRegistered: true, serviceTierAlias: true }).via, 'multi-source');
check('-fast 后缀被剥出基座型号', stripServiceTierSuffix('gpt-5-fast'), 'gpt-5');
check('-free 后缀同理', stripServiceTierSuffix('minimax-m3-free'), 'minimax-m3');
check('没有档位后缀返回 null', stripServiceTierSuffix('gpt-5.6-sol-pro'), null);
check('型号中间的 fast 不算后缀', stripServiceTierSuffix('grok-4-1-fast-non-reasoning'), null);

// ── LiteLLM 兜底的取值规矩 ────────────────────────────────────────────
const llmEntry = (key: string, vendorId: string | null, over: Partial<import('./sources/types').GatewayFacts> = {}) => ({
  key,
  vendorId,
  facts: {
    inputPerMTok: null,
    outputPerMTok: null,
    cachedInputPerMTok: null,
    contextWindow: null,
    maxOutput: null,
    modalities: { input: ['text'], output: ['text'] },
    ...over,
  },
});
check(
  '第一方 provider 的报价优先于托管商',
  pickLiteLlmField(
    [llmEntry('azure/gpt-4o', null, { outputPerMTok: 12 }), llmEntry('gpt-4o', 'openai', { outputPerMTok: 10 })],
    'openai',
    'outputPerMTok',
  ),
  10,
);
check(
  '没有第一方时托管商一致才采信',
  pickLiteLlmField(
    [llmEntry('a/llama', null, { outputPerMTok: 0.9 }), llmEntry('b/llama', null, { outputPerMTok: 0.9 })],
    'meta',
    'outputPerMTok',
  ),
  0.9,
);
check(
  '托管商报价不一致就留空，不取中位数也不取最低价',
  pickLiteLlmField(
    [llmEntry('a/llama', null, { outputPerMTok: 0.9 }), llmEntry('b/llama', null, { outputPerMTok: 0.6 })],
    'meta',
    'outputPerMTok',
  ),
  null,
);

// ── Epoch 侧的合规闸门（第三条渗入路径）────────────────────────────────
// Epoch 自己是 CC-BY 4.0，但它的 *_external.csv 是转载别人的榜单，转载谁就带着谁的条款。
const AA_CSV = 'Model version,Score,Source\nclaude-fable-5_max,0.6,https://artificialanalysis.ai/evaluations/scicode\n';
const ARENA_CSV = 'Model version,Score,Source link\nclaude-opus-5_max,1690,https://web.lmarena.ai/leaderboard\n';
const CLEAN_CSV = 'Model version,Score,Source\ngpt-5.6-sol_max,0.73,https://deepswe.datacurve.ai/\n';
check('scicode 按文件名直接拉黑', classifyEpochFile('scicode_external.csv', CLEAN_CSV).blocked, true);
check('来源列指向 AA 的一律整份丢弃', classifyEpochFile('somenewbench_external.csv', AA_CSV).blocked, true);
check('干净文件放行', classifyEpochFile('deepswe_external.csv', CLEAN_CSV).blocked, false);
check('干净文件不报命中域名', classifyEpochFile('deepswe_external.csv', CLEAN_CSV).hosts, []);
// LMArena 与 AA 的处置不同：前者只禁「我们自己去抓」，我们消费的是 Epoch 的 CC-BY 再分发。
check(
  '未豁免的文件命中 LMArena 血缘要拦',
  classifyEpochFile('somenewarena_external.csv', ARENA_CSV).blocked,
  true,
);
check(
  'webdev_arena 按 HANDOFF 4.2 的既有决定放行',
  classifyEpochFile('webdev_arena_external.csv', ARENA_CSV).blocked,
  false,
);
check(
  '放行也要如实记下命中的域名，不当没看见',
  classifyEpochFile('webdev_arena_external.csv', ARENA_CSV).hosts.includes('lmarena.ai'),
  true,
);
// 豁免只对 LMArena 生效。哪天 webdev_arena 里混进 AA，照拦。
check(
  'LMArena 豁免不适用于 AA',
  classifyEpochFile('webdev_arena_external.csv', AA_CSV).blocked,
  true,
);

// ── LiveBench ─────────────────────────────────────────────────────────
check(
  'release 清单能从上游常量里解析出来',
  parseLiveBenchReleases('LIVE_BENCH_RELEASES = {"2024-07-26", "2026-06-25", "2025-04-25"}'),
  ['2024-07-26', '2025-04-25', '2026-06-25'],
);
check('上游改写法时返回空数组，交给兜底清单', parseLiveBenchReleases('nothing here'), []);
// CSV 是按 task 的宽表，分组平均要自己算；缺任何一个 task 就不给分——半个分组的平均没有意义。
check(
  '分组平均',
  categoryAverage({ code_generation: '78.873', code_completion: '80.435' }, [
    'code_generation',
    'code_completion',
  ]),
  79.65,
);
check(
  '缺一个 task 就返回 null',
  categoryAverage({ code_generation: '78.873' }, ['code_generation', 'code_completion']),
  null,
);
check('空 task 列表返回 null', categoryAverage({ a: '1' }, []), null);
// effort 后缀表。这一条是本模块最容易改错的地方：多剥一个后缀就把型号名剥没了。
check('剥 -high-effort', stripLiveBenchEffort('claude-opus-4-7-xhigh-effort'), 'claude-opus-4-7');
check(
  '剥 -thinking-64k-high-effort 三层',
  stripLiveBenchEffort('claude-opus-4-5-20251101-thinking-64k-high-effort'),
  'claude-opus-4-5-20251101',
);
check('剥 -nothinking', stripLiveBenchEffort('gpt-5.2-2025-12-11-nothinking'), 'gpt-5.2-2025-12-11');
check('剥连写的 -highthinking', stripLiveBenchEffort('gemini-2.5-flash-lite-highthinking'), 'gemini-2.5-flash-lite');
check('剥 -non-reasoning', stripLiveBenchEffort('grok-4-1-fast-non-reasoning'), 'grok-4-1-fast');
check('剥「月-年」日期戳', stripLiveBenchEffort('gemini-3-pro-preview-11-2025'), 'gemini-3-pro-preview');
// 这三条是护栏：剥过头会把真实型号名毁掉。
check('裸的 -max 不能剥（qwen3.8-max 的 max 是型号的一部分）', stripLiveBenchEffort('qwen3.8-max'), 'qwen3.8-max');
check('-flash 不能剥', stripLiveBenchEffort('gemini-3.5-flash-high'), 'gemini-3.5-flash');
check('-nano 不能剥', stripLiveBenchEffort('gpt-5.4-nano-xhigh'), 'gpt-5.4-nano');
check('没有后缀时原样返回', stripLiveBenchEffort('deepseek-v4-pro'), 'deepseek-v4-pro');

// ── 稳定序列化 ────────────────────────────────────────────────────────
check(
  '对象键排序后一致',
  stableStringify({ b: 1, a: { d: 2, c: 3 } }) === stableStringify({ a: { c: 3, d: 2 }, b: 1 }),
  true,
);

// ── 合理性校验闸门 ────────────────────────────────────────────────────
function model(overrides: Partial<ModelRecord> = {}): ModelRecord {
  return {
    id: 'v/m',
    slug: 'v-m',
    name: 'M',
    vendorId: 'v',
    releaseDate: '2026-01-01',
    releaseDatePrecision: 'day',
    knowledgeCutoff: null,
    retiredAt: null,
    contextWindow: 1000,
    maxOutput: 100,
    pricing: { inputPerMTok: 1, outputPerMTok: 2, cachedInputPerMTok: null },
    modalities: { input: ['text'], output: ['text'] },
    capabilities: { toolCall: true, reasoning: true, structuredOutput: null, promptCaching: null },
    openWeights: false,
    license: null,
    params: { totalB: null, activeB: null, confidence: 'unknown' },
    benchmarks: {
      eci: null,
      swe_bench_verified: null,
      swe_bench_vendor: null,
      swe_bench_pro: null,
      aime: null,
      gpqa_diamond: null,
      arc_agi_2: null,
      fiction_live: null,
      webdev_arena_elo: null,
    },
    coding: [],
    provenance: {},
    firstSeenAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function score(overrides: Partial<BenchmarkScore> = {}): BenchmarkScore {
  return {
    league: 'swe_bench_pro',
    score: 45,
    unit: 'pct',
    attribution: 'vendor-self-reported',
    source: 'models.dev',
    sourceUrl: 'https://labs.scale.com/leaderboard',
    ...overrides,
  };
}
function snapshot(models: ModelRecord[]): WorldSnapshot {
  return {
    generatedAt: '2026-01-01T00:00:00.000Z',
    sources: {
      'models.dev': { ok: true, fetchedAt: null },
      'epoch.ai': { ok: true, fetchedAt: null },
      huggingface: { ok: false, fetchedAt: null },
      openrouter: { ok: true, fetchedAt: null },
      'vercel-gateway': { ok: true, fetchedAt: null },
      litellm: { ok: true, fetchedAt: null },
      livebench: { ok: true, fetchedAt: null },
      lmarena: { ok: true, fetchedAt: null },
      derived: { ok: true, fetchedAt: null },
      override: { ok: true, fetchedAt: null },
    },
    vendors: [
      {
        id: 'v',
        name: 'V',
        nameZh: 'V',
        country: 'US',
        continent: 'west',
        motif: 'wanderer',
        accentColor: '#000000',
        homepage: null,
      },
    ],
    models,
  };
}

const many = Array.from({ length: 100 }, (_, i) =>
  model({ id: `v/m${i}`, slug: `v-m${i}` }),
);
check('正常快照通过', validateSnapshot(snapshot(many), snapshot(many)).ok, true);
check(
  '存活模型骤降 20% 被拦截',
  validateSnapshot(snapshot(many.slice(0, 80)), snapshot(many)).ok,
  false,
);
check(
  '大规模转退役同样被拦截（总数不变也不放过）',
  validateSnapshot(
    snapshot(many.map((m, i) => (i < 20 ? { ...m, retiredAt: '2026-01-02' } : m))),
    snapshot(many),
  ).ok,
  false,
);
check(
  '零价格被拦截',
  validateSnapshot(
    snapshot([model({ pricing: { inputPerMTok: 0, outputPerMTok: 2, cachedInputPerMTok: null } })]),
    null,
  ).ok,
  false,
);
check(
  '负价格被拦截',
  validateSnapshot(
    snapshot([model({ pricing: { inputPerMTok: -1, outputPerMTok: 2, cachedInputPerMTok: null } })]),
    null,
  ).ok,
  false,
);
check(
  '闭源模型标 exact 被拦截',
  validateSnapshot(
    snapshot([model({ openWeights: false, params: { totalB: 100, activeB: null, confidence: 'exact' } })]),
    null,
  ).ok,
  false,
);
check(
  'id 重复被拦截',
  validateSnapshot(snapshot([model(), model()]), null).ok,
  false,
);
check('空模型列表被拦截', validateSnapshot(snapshot([]), null).ok, false);
check(
  '榜单分数超出 0–100 被拦截',
  validateSnapshot(
    snapshot([model({ benchmarks: { ...model().benchmarks, swe_bench_vendor: 0.78 * 100 + 40 } })]),
    null,
  ).ok,
  false,
);
check(
  '自报成绩溯源标成 epoch.ai 被拦截',
  validateSnapshot(
    snapshot([
      model({
        benchmarks: { ...model().benchmarks, swe_bench_vendor: 74.4 },
        provenance: { 'benchmarks.swe_bench_vendor': 'epoch.ai' },
      }),
    ]),
    null,
  ).ok,
  false,
);
check(
  '自报成绩溯源标 models.dev 才放行',
  validateSnapshot(
    snapshot([
      model({
        benchmarks: { ...model().benchmarks, swe_bench_vendor: 74.4 },
        provenance: { 'benchmarks.swe_bench_vendor': 'models.dev' },
      }),
    ]),
    null,
  ).ok,
  true,
);
// 新增字段第一次上线时，历史快照里没有这个键，读到的是 undefined。
// 覆盖率探针若用 `!== null` 就会把「字段不存在」算成 100%，制造一条假的「骤降」告警。
check(
  '历史快照缺字段不产生假告警',
  validateSnapshot(
    snapshot(many),
    snapshot(
      many.map((m) => {
        const legacy = { ...m.benchmarks } as Partial<ModelRecord['benchmarks']>;
        delete legacy.swe_bench_vendor;
        return { ...m, benchmarks: legacy as ModelRecord['benchmarks'] };
      }),
    ),
  ).warnings.filter((w) => w.includes('swe_bench_vendor')),
  [],
);
check(
  '必填字段覆盖率跌超 5 个百分点被拦截',
  validateSnapshot(
    snapshot(many.map((m, i) => (i < 10 ? { ...m, contextWindow: null } : m))),
    snapshot(many),
  ).ok,
  false,
);

// ── 承重字段的相对跌幅闸门 ─────────────────────────────────────────────
// 复现 2026-09-05 的事故：ECI 只有四成模型有，上游改了文件名后归零，绝对跌幅规则拦不住。
const withEci = (m: ModelRecord, on: boolean): ModelRecord => ({
  ...m,
  benchmarks: { ...m.benchmarks, eci: on ? 150 : null },
});
const eciBefore = many.map((m, i) => withEci(m, i < 40));
check(
  '承重字段 ECI 覆盖率归零被拦截',
  validateSnapshot(snapshot(many.map((m) => withEci(m, false))), snapshot(eciBefore)).ok,
  false,
);
check(
  '承重字段 ECI 覆盖率相对跌超一半被拦截（40% → 15%）',
  validateSnapshot(snapshot(many.map((m, i) => withEci(m, i < 15))), snapshot(eciBefore)).ok,
  false,
);
check(
  '承重字段 ECI 覆盖率小幅波动放行（40% → 32%）',
  validateSnapshot(snapshot(many.map((m, i) => withEci(m, i < 32))), snapshot(eciBefore)).ok,
  true,
);
check(
  '承重字段首次出现（历史为 0）不拦',
  validateSnapshot(snapshot(eciBefore), snapshot(many.map((m) => withEci(m, false)))).ok,
  true,
);

// ── coding[] 的结构与量纲闸门 ─────────────────────────────────────────
check(
  '正常的 coding[] 放行',
  validateSnapshot(
    snapshot([
      model({
        coding: [
          score({ league: 'swe_bench_verified', score: 75.6, attribution: 'third-party', source: 'epoch.ai', sourceUrl: 'https://epoch.ai/benchmarks' }),
          score({ league: 'swe_bench_pro', score: 45.9 }),
          score({ league: 'webdev_arena_elo', score: 1412, unit: 'elo', attribution: 'third-party', source: 'epoch.ai', sourceUrl: 'https://epoch.ai/benchmarks' }),
        ],
      }),
    ]),
    null,
  ).ok,
  true,
);
// 同一个赛制两条，前端算分位时同一个模型会被数两次。
check(
  '同赛制出现多条被拦截',
  validateSnapshot(
    snapshot([model({ coding: [score({ score: 40 }), score({ score: 60 })] })]),
    null,
  ).ok,
  false,
);
// Elo 混进百分数池会让所有百分数模型看起来都是满分——unit 就是为了防这件事。
check(
  'Elo 分数不按百分数区间校验（1412 合法）',
  validateSnapshot(
    snapshot([model({ coding: [score({ league: 'webdev_arena_elo', score: 1412, unit: 'elo', attribution: 'third-party', source: 'epoch.ai' })] })]),
    null,
  ).ok,
  true,
);
check(
  '百分数赛制里出现 1412 被拦截（漏标 unit 的典型症状）',
  validateSnapshot(snapshot([model({ coding: [score({ score: 1412 })] })]), null).ok,
  false,
);
check(
  'Epoch 来源却标成厂商自报被拦截',
  validateSnapshot(
    snapshot([model({ coding: [score({ source: 'epoch.ai', attribution: 'vendor-self-reported' })] })]),
    null,
  ).ok,
  false,
);
check(
  'coding[] 里出现 AA 血缘域名被拦截',
  validateSnapshot(
    snapshot([
      model({
        coding: [score({ league: 'terminal_bench_hard', score: 17.4, sourceUrl: 'https://openrouter.ai/a/b/benchmarks' })],
      }),
    ]),
    null,
  ).ok,
  false,
);
// ── 一个赛制只能有一种量纲 ────────────────────────────────────────────
// Epoch 那个 zip 里至少混着四种量纲（0–1 小数、0–100 百分数、自定义评分标度、加速倍率），
// 某个源忘了乘 100 是最可能出现的错误，而它不会报错，只会让分位数变成噪声。
check(
  '同一赛制两种量纲被拦截',
  validateSnapshot(
    snapshot([
      model({ id: 'v/a', slug: 'v-a', coding: [score({ league: 'gso', score: 47, unit: 'pct' })] }),
      model({ id: 'v/b', slug: 'v-b', coding: [score({ league: 'gso', score: 0.47, unit: 'index' })] }),
    ]),
    null,
  ).ok,
  false,
);
check(
  '不同赛制各用各的量纲是正常的',
  validateSnapshot(
    snapshot([
      model({
        coding: [
          score({ league: 'gso', score: 47, unit: 'pct' }),
          score({ league: 'ale_bench', score: 2176.88, unit: 'index' }),
          score({ league: 'algotune', score: 1.52, unit: 'index' }),
          score({ league: 'webdev_arena_elo', score: 1412, unit: 'elo', source: 'epoch.ai', attribution: 'third-party' }),
        ],
      }),
    ]),
    null,
  ).ok,
  true,
);
// ALE-Bench 的 Performance 是 137–2177 的自定义标度，AlgoTune 的 Score 是 1.3–2 倍的加速比。
// 这两个赛制标 index 就是为了绕开百分数的区间检查——标成 pct 会被下面这条拦下来。
check(
  'ALE-Bench 的 2176.88 标成 pct 会被拦截',
  validateSnapshot(
    snapshot([model({ coding: [score({ league: 'ale_bench', score: 2176.88, unit: 'pct' })] })]),
    null,
  ).ok,
  false,
);
check(
  'index 量纲不受 0–100 区间约束',
  validateSnapshot(
    snapshot([model({ coding: [score({ league: 'ale_bench', score: 2176.88, unit: 'index' })] })]),
    null,
  ).ok,
  true,
);

// 坑 5 的数组版本：历史快照里没有 coding 字段时读到的是 undefined，
// 探针写成 `m.coding.length` 会直接抛异常，写成 `!== null` 会把「字段不存在」算成有值。
check(
  '历史快照没有 coding 字段时不抛异常、也不产生假告警',
  validateSnapshot(
    snapshot(many.map((m) => ({ ...m, coding: [score()] }))),
    snapshot(
      many.map((m) => {
        const legacy = { ...m } as Partial<ModelRecord>;
        delete legacy.coding;
        return legacy as ModelRecord;
      }),
    ),
  ).warnings.filter((w) => w.includes('coding')),
  [],
);

// ── scores[] 与 benchmarks[] 的闸门 ────────────────────────────────────
// scores[] 是 coding[] 的超集，两个数组同一套规矩，外加两种新量纲与元信息一致性。
const epochScore = (over: Partial<BenchmarkScore>) =>
  score({ attribution: 'third-party', source: 'epoch.ai', sourceUrl: null, ...over });
const metaOf = (over: Partial<import('../../src/lib/types').BenchmarkMeta>) => ({
  id: 'hle',
  sourceFile: 'hle_external.csv',
  scoreColumn: 'Accuracy',
  unit: 'pct' as const,
  randomBaseline: 4.8,
  scoreCeiling: 100,
  releaseDate: null,
  supersededBy: null,
  inEci: true,
  models: 1,
  ...over,
});
const withScores = (list: BenchmarkScore[], coding: BenchmarkScore[] = []) =>
  snapshot([model({ coding, scores: list })]);
check(
  'minutes 与 usd 是合法量纲，usd 允许为负（Vending-Bench 亏钱）',
  validateSnapshot(
    withScores([
      epochScore({ league: 'metr_time_horizons', score: 352.25, unit: 'minutes' }),
      epochScore({ league: 'vending_bench_2', score: -31.18, unit: 'usd' }),
    ]),
    null,
  ).failures,
  [],
);
check(
  '负的时长被拦截',
  validateSnapshot(withScores([epochScore({ league: 'metr_time_horizons', score: -1, unit: 'minutes' })]), null).ok,
  false,
);
check(
  'scores[] 里 pct 越界被拦截（metadata 的 scale 判错的典型症状）',
  validateSnapshot(withScores([epochScore({ league: 'lech_mazur_writing', score: 830, unit: 'pct' })]), null).ok,
  false,
);
check(
  'scores[] 同赛制多条被拦截',
  validateSnapshot(
    withScores([epochScore({ league: 'hle', score: 20 }), epochScore({ league: 'hle', score: 30 })]),
    null,
  ).ok,
  false,
);
check(
  'coding[] 里有、scores[] 里没有 → 超集关系被破坏，拦截',
  validateSnapshot(withScores([epochScore({ league: 'hle', score: 20 })], [score()]), null).ok,
  false,
);
check(
  '同一 league 在 coding[] 与 scores[] 里量纲不同被拦截',
  validateSnapshot(
    snapshot([
      model({
        coding: [score({ league: 'gso', score: 47, unit: 'pct' })],
        scores: [score({ league: 'gso', score: 0.47, unit: 'index' })],
      }),
    ]),
    null,
  ).ok,
  false,
);
check(
  '历史快照没有 scores 字段是合法的（可选字段）',
  validateSnapshot(snapshot([model()]), null).ok,
  true,
);
check(
  'benchmarks[].models 与 scores[] 实际命中数不一致被拦截',
  validateSnapshot(
    { ...withScores([epochScore({ league: 'hle', score: 20 })]), benchmarks: [metaOf({ models: 3 })] },
    null,
  ).ok,
  false,
);
check(
  'scores[] 里有榜单却没有元信息被拦截',
  validateSnapshot(
    { ...withScores([epochScore({ league: 'hle', score: 20 }), epochScore({ league: 'gpqa_diamond', score: 80 })]), benchmarks: [metaOf({})] },
    null,
  ).ok,
  false,
);
check(
  '元信息与命中数一致时放行',
  validateSnapshot(
    { ...withScores([epochScore({ league: 'hle', score: 20 })]), benchmarks: [metaOf({})] },
    null,
  ).failures,
  [],
);
check(
  '训练算力为 0 或负数被拦截',
  validateSnapshot(snapshot([model({ trainingComputeFlop: 0 })]), null).ok,
  false,
);
check(
  '训练算力 null 是合法的（Epoch 也没估算）',
  validateSnapshot(snapshot([model({ trainingComputeFlop: null })]), null).ok,
  true,
);
check(
  'scores[] 的 sourceUrl 指向 AA 血缘同样被字段级扫描抓到',
  findBlockedBenchmarkSources([
    { id: 'v/m', scores: [{ league: 'x', sourceUrl: 'https://artificialanalysis.ai/x' }] },
  ]).length,
  1,
);

// ── 变更日志 ──────────────────────────────────────────────────────────
// diffSnapshots 是「更新引擎」的核心：sync 前后各拍一张快照，差集就是速报内容。
// 与首页用同一套 buildPlazaRoster / buildChampions，这里只验「变了会被看见」。
const changelogBase = snapshot([model()]);
const changelogVendor = (id: string, nameZh: string, continent: 'east' | 'west' = 'west') => ({
  id,
  name: id,
  nameZh,
  country: 'US',
  continent,
  motif: 'wanderer',
  accentColor: '#000000',
  homepage: null,
});
const changelogOld = {
  ...changelogBase,
  vendors: [changelogVendor('a', '厂商甲'), changelogVendor('b', '厂商乙')],
  models: [
    model({ id: 'a/m1', slug: 'a-m1', name: 'M1', vendorId: 'a', benchmarks: { ...model().benchmarks, eci: 100 } }),
    model({ id: 'a/m2', slug: 'a-m2', name: 'M2', vendorId: 'a' }),
    model({ id: 'b/m3', slug: 'b-m3', name: 'M3', vendorId: 'b', releaseDate: '2026-01-05' }),
  ],
};
const changelogNew = {
  ...changelogBase,
  generatedAt: '2026-01-06T00:00:00.000Z',
  vendors: [changelogVendor('a', '厂商甲'), changelogVendor('b', '厂商乙'), changelogVendor('c', '厂商丙')],
  models: [
    model({ id: 'a/m1', slug: 'a-m1', name: 'M1', vendorId: 'a', benchmarks: { ...model().benchmarks, eci: 100 } }),
    model({ id: 'a/m2', slug: 'a-m2', name: 'M2', vendorId: 'a', retiredAt: '2026-01-06' }),
    model({ id: 'b/m3', slug: 'b-m3', name: 'M3', vendorId: 'b', releaseDate: '2026-01-05' }),
    model({
      id: 'b/m4',
      slug: 'b-m4',
      name: 'M4',
      vendorId: 'b',
      releaseDate: '2026-01-06',
      benchmarks: { ...model().benchmarks, eci: 120 },
    }),
    model({ id: 'c/m5', slug: 'c-m5', name: 'M5', vendorId: 'c' }),
  ],
};
const changelogDiff = diffSnapshots(changelogOld, changelogNew);
check('变更日志：新模型被看见', changelogDiff?.newModels.map((m) => m.id), ['b/m4', 'c/m5']);
check('变更日志：退役被看见', changelogDiff?.retired.map((m) => m.id), ['a/m2']);
check('变更日志：新厂商被看见', changelogDiff?.newVendors.map((v) => v.id), ['c']);
check('变更日志：没有变化时返回 null', diffSnapshots(changelogOld, changelogOld), null);

// ── 福利价格雷达 ──────────────────────────────────────────────────
// buildPriceRadar 是福利页的自动引擎：同家族按输入价排序，第一档必须是最便宜的调用渠道。
// 用极小 fixture 验三件事：排序正确、退役排除、无价排除、厂商名回退。
const radarVendors = [
  { id: 'a', name: 'A', nameZh: '厂商甲', country: 'US', continent: 'west' as const, motif: 'wanderer' as const, accentColor: '#000', homepage: null },
  { id: 'b', name: 'B', nameZh: '厂商乙', country: 'US', continent: 'west' as const, motif: 'wanderer' as const, accentColor: '#000', homepage: null },
];
const radarModels = [
  model({ id: 'a/deepseek-chat', slug: 'a-deepseek-chat', name: 'DeepSeek Chat', vendorId: 'a', pricing: { inputPerMTok: 0.5, outputPerMTok: 1.5, cachedInputPerMTok: null } }),
  model({ id: 'b/deepseek-v3', slug: 'b-deepseek-v3', name: 'DeepSeek V3', vendorId: 'b', pricing: { inputPerMTok: 0.2, outputPerMTok: 0.6, cachedInputPerMTok: null } }),
  model({ id: 'a/deepseek-retired', slug: 'a-deepseek-retired', name: 'DeepSeek Old', vendorId: 'a', retiredAt: '2026-01-01', pricing: { inputPerMTok: 0.01, outputPerMTok: 0.01, cachedInputPerMTok: null } }),
  model({ id: 'a/deepseek-noprice', slug: 'a-deepseek-noprice', name: 'DeepSeek NoPrice', vendorId: 'a', pricing: { inputPerMTok: null, outputPerMTok: null, cachedInputPerMTok: null } }),
];
const radar = buildPriceRadar(radarModels, radarVendors as unknown as WorldSnapshot['vendors']);
check('价格雷达：DeepSeek 家族命中', radar.map((f) => f.key), ['deepseek']);
check('价格雷达：最便宜的排在第一位', radar[0]?.offers[0]?.modelId, 'b/deepseek-v3');
check('价格雷达：退役模型不参与', radar[0]?.offers.some((o) => o.modelId.includes('retired')), false);
check('价格雷达：无价格模型不参与', radar[0]?.offers.some((o) => o.modelId.includes('noprice')), false);
check('价格雷达：厂商中文名回退', radar[0]?.offers[0]?.vendorZh, '厂商乙');

const radarOcr = buildPriceRadar(
  [model({ id: 'a/deepseek-ocr-2', slug: 'a-ocr', name: 'DeepSeek OCR 2', vendorId: 'a', pricing: { inputPerMTok: 0.01, outputPerMTok: 0.01, cachedInputPerMTok: null } })],
  radarVendors as unknown as WorldSnapshot['vendors'],
);
check('价格雷达：OCR 专用端点不进雷达', radarOcr.length, 0);

// ── 汇总 ──────────────────────────────────────────────────────────────
console.log(`\n自检完成：${passed} 项通过，${failures.length} 项失败`);
for (const f of failures) console.error(`  ✗ ${f}`);
process.exitCode = failures.length === 0 ? 0 : 1;
