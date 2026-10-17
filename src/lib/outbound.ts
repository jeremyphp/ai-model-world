/**
 * 站外链接在 B 站 Toy 版里的去留。
 *
 * 2026-09-30 起 Toy 连续三次被机审以「违法违规」驳回，包里新增的内容挑不出问题，
 * 最可疑的是存量的站外链接：大量指向境内打不开的网站（Hugging Face 一项就近两千处）、
 * 境外 AI 服务官网、论坛和外国政府网站。Toy 版把这些链接去掉、只留文字；
 * 其它部署（Vercel 等）不受影响。
 *
 * 判断只看域名，命中就整条不出链接——网址本身也不写进页面，免得机审在内嵌数据里扫到。
 */

const IS_TOY = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').startsWith('/toy/');

/** 是否在为 B 站 Toy 构建。Toy 的机审对站外链接很敏感，广告位也要整块隐藏。 */
export function isToyBuild(): boolean {
  return IS_TOY;
}

const BLOCKED_HOST =
  /(^|\.)(huggingface\.co|google|google\.com|youtube\.com|kaggle\.com|x\.com|x\.ai|twitter\.com|openai\.com|chatgpt\.com|anthropic\.com|claude\.ai|perplexity\.ai|meta\.ai|meta\.com|facebook\.com|reddit\.com|medium\.com|substack\.com|discord\.gg|linux\.do|moegirl\.org\.cn|gov\.sa)$/i;

export function isBlockedUrl(url: string): boolean {
  try {
    return BLOCKED_HOST.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Toy 版里不该出链接时返回 null，调用方据此退回纯文字 */
export function outbound(url: string | null | undefined): string | null {
  if (!url) return null;
  return IS_TOY && isBlockedUrl(url) ? null : url;
}
