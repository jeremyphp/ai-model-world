/**
 * 福利情报的「引擎」部分：API 价格雷达。
 *
 * 需求：读者想知道「调 DeepSeek 最便宜的是哪家」。模型快照里有 673 个模型、
 * 73 家厂商、统一为 $/Mtok 的价格——答案就在数据里，不需要任何人维护。
 *
 * 做法：按「家族关键词」把存活模型分簇（deepseek / qwen / glm / kimi …），
 * 每簇内按输入价排序取最便宜的若干档，标出厂商与价格。
 * 数据每 12 小时随 sync 快照自动刷新，页面永远是最新价格。
 *
 * 纯函数、确定性、可进 selftest：不写死任何厂商名或价格。
 */

import type { ModelRecord, Vendor } from './types';

export interface PriceOffer {
  modelId: string;
  name: string;
  slug: string;
  vendorId: string;
  vendorZh: string;
  input: number;
  output: number;
}

export interface PriceRadarFamily {
  key: string;
  /** 展示名，如「DeepSeek」 */
  label: string;
  /** 一行定位，如「通用推理之王，中文社区最常用」 */
  blurb: string;
  /** 按输入价升序的前几档，第一档即最便宜 */
  offers: PriceOffer[];
}

/** 家族表：关键词按 id 小写匹配。顺序即页面展示顺序。 */
const FAMILIES: { key: string; label: string; blurb: string; match: RegExp }[] = [
  { key: 'deepseek', label: 'DeepSeek', blurb: '中文社区的通用主力，写码、推理都靠它', match: /deepseek/ },
  { key: 'qwen', label: '通义千问 Qwen', blurb: '阿里系开源全家桶，参数全、生态大', match: /qwen/ },
  { key: 'glm', label: '智谱 GLM', blurb: '清华系，Agent 与多模态有独活', match: /glm/ },
  { key: 'kimi', label: 'Kimi K 系列', blurb: '长文本与思考模型，K2 之后价格能打', match: /kimi/ },
  { key: 'doubao', label: '豆包 Doubao', blurb: '字节系，视频生成与低价模型', match: /doubao/ },
  { key: 'llama', label: 'Llama', blurb: 'Meta 开源，全球生态最大', match: /llama/ },
  { key: 'claude', label: 'Claude', blurb: 'Anthropic，写码口碑第一梯队', match: /claude/ },
  { key: 'gpt', label: 'GPT / OpenAI', blurb: 'OpenAI 旗舰', match: /gpt|openai/ },
  { key: 'gemini', label: 'Gemini', blurb: 'Google 多模态全家桶', match: /gemini/ },
  { key: 'grok', label: 'Grok', blurb: 'xAI，脑洞与速度', match: /grok/ },
  { key: 'minimax', label: 'MiniMax', blurb: '海螺视频与长上下文', match: /minimax/ },
  { key: 'hunyuan', label: '混元 Hunyuan', blurb: '腾讯系', match: /hunyuan/ },
  { key: 'ernie', label: '文心 Ernie', blurb: '百度系', match: /ernie/ },
  { key: 'step', label: '阶跃 Step', blurb: '国产多模态黑马', match: /\bstep|stepfun/ },
  { key: 'mistral', label: 'Mistral', blurb: '欧洲开源主力', match: /mistral/ },
];

/** 每簇最多展示的档位数 */
const MAX_OFFERS = 5;

/**
 * 非对话类端点不参与雷达：OCR/图像/音频/向量等专用接口价格再低，
 * 也不是「调这个模型」的答案。放进同一张榜会把「最低」标给 OCR 之类，
 * 读者照着选就选错了。这类信息有价值但属于另一个话题（见福利播报），不进雷达。
 */
const NON_CHAT = /ocr|image|audio|tts|asr|embedding|rerank|video|voice|speech|transcri|whisper|whisper|moderation|guard/i;

/** 纯函数：把快照算成价格雷达。没有定价的模型不参与。 */
export function buildPriceRadar(
  models: ModelRecord[],
  vendors: Vendor[],
): PriceRadarFamily[] {
  const vendorZh = new Map(vendors.map((v) => [v.id, v.nameZh]));

  const families: PriceRadarFamily[] = [];
  for (const fam of FAMILIES) {
    const offers: PriceOffer[] = [];
    for (const m of models) {
      if (m.retiredAt) continue;
      if (m.pricing.inputPerMTok == null || m.pricing.outputPerMTok == null) continue;
      const id = m.id.toLowerCase();
      if (!fam.match.test(id)) continue;
      if (NON_CHAT.test(id)) continue;
      offers.push({
        modelId: m.id,
        name: m.name,
        slug: m.slug,
        vendorId: m.vendorId,
        vendorZh: vendorZh.get(m.vendorId) ?? m.vendorId,
        input: m.pricing.inputPerMTok,
        output: m.pricing.outputPerMTok,
      });
    }
    if (offers.length === 0) continue;
    offers.sort((a, b) => a.input - b.input || a.output - b.output || a.modelId.localeCompare(b.modelId));
    families.push({ key: fam.key, label: fam.label, blurb: fam.blurb, offers: offers.slice(0, MAX_OFFERS) });
  }
  return families;
}
