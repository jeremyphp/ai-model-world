/**
 * 用 B 站公开的视频搜索接口，给每个值得搜的模型抓一批实测视频，写进 `data/bilibili.json`。
 *
 *   npm run bilibili            # 只补缺的和过期的
 *   npm run bilibili -- --force # 全部重抓
 *
 * **手动跑，不在 `npm run sync` 里，也不在构建期。** 三个理由：
 *
 * 1. B 站风控很紧。空间接口 `x/space/arc/search` 现在基本一翻就 `-412 request was banned`；
 *    搜索接口宽松些，但一轮 140+ 个请求随时可能被掐。把它放进构建，等于把
 *    「能不能发版」押在别人的风控策略上。
 * 2. 产物提交进仓库，构建期完全离线。B 站哪天封了接口，站点照常构建，视频停在上一次刷新。
 * 3. 变化频率不同。模型数据一天一变，某个模型的测评视频一周才多几条。
 *
 * **断点续传**：每抓完一个模型就落盘。被风控掐断时保留已抓到的部分，下次接着跑。
 */

import fs from 'node:fs';
import path from 'node:path';

import { baseName, MAX_PER_MODEL, pickVideos, type VideoLibrary, type VideoRecord } from '../../src/lib/videos.ts';
import type { ModelRecord, WorldSnapshot } from '../../src/lib/types.ts';

/** 历史字段的写入值：置顶规则已撤掉，写 0 表示「不偏向任何 UP 主」 */
const AUTHOR_MID = 0;
/** 搜索词后缀。「测评」比「实测」「评测」召回都好，只发一个请求就用它 */
const KEYWORD = '测评';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
/** 每次搜索之间的间隔。压到 1 秒以下很快就会吃 -412。 */
const DELAY_MS = 2500;
/**
 * 每个名字最多翻几页。
 *
 * 一页 20 条，但 B 站的相关性排序里混了不少不对题的，过完「标题必须出现模型名」
 * 这道闸门大约只剩四分之一。实测「DeepSeek V4 Flash 测评」：
 * 第 1 页过滤后 4 条、第 2 页累计 7 条、第 3 页累计 9 条。只翻一页会让读者觉得
 * 「B 站明明搜得到更多」——那是真的更多，在第二三页上。
 *
 * 不是每次都翻满：凑够 12 条就停，所以热门模型多半一页就够了。
 */
const MAX_PAGES = 3;
/** 搜索接口一页的条数，用来判断还有没有下一页 */
const PAGE_SIZE = 20;
/** 多久算过期，天 */
const STALE_DAYS = 14;
/**
 * 覆盖范围：综合智力进前 120，或最近 180 天内发布。
 *
 * 第一版是「前 60 / 120 天」，143 个模型——结果 DeepSeek V4 Pro 落在外面：
 * ECI 排 61、发布 146 天，两条线各差一点。而它是有 41 万播放实测视频的热门模型。
 * 门槛卡在「刚好漏掉知名模型」的位置就是定错了，放宽到 231 个。
 * 再往上放意义不大：冷门模型搜出来基本会被标题过滤掉，纯属给 B 站添堵。
 */
const TOP_ECI = 120;
const RECENT_DAYS = 180;

const OUT = path.join(process.cwd(), 'data', 'bilibili.json');
const SNAPSHOT = path.join(process.cwd(), 'data', 'models.json');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 挑出「值得搜」的模型：在役，且综合智力进前 60 或最近 120 天发布。
 *
 * 为什么不是全部 553 个：一轮就是 553 个请求、二十多分钟，而且冷门模型
 * 搜出来基本都会被标题过滤掉，纯属给 B 站添堵。这两条线覆盖的正是读者会点进去的那些页。
 */
function targetModels(snapshot: WorldSnapshot): ModelRecord[] {
  const now = Date.parse(snapshot.generatedAt);
  const alive = snapshot.models.filter((m) => !m.retiredAt);

  const topEci = new Set(
    alive
      .filter((m) => m.benchmarks?.eci != null)
      .sort((a, b) => b.benchmarks.eci! - a.benchmarks.eci!)
      .slice(0, TOP_ECI)
      .map((m) => m.id),
  );
  const recent = new Set(
    alive
      .filter((m) => m.releaseDate != null && (now - Date.parse(m.releaseDate)) / 86_400_000 <= RECENT_DAYS)
      .map((m) => m.id),
  );

  return alive.filter((m) => topEci.has(m.id) || recent.has(m.id));
}

interface SearchItem {
  bvid: string;
  title: string;
  pic: string;
  duration: string;
  pubdate: number;
  play: number;
  author: string;
  mid: number;
}

/** 搜索接口认 buvid3，先访问一次首页把 cookie 换出来 */
async function freshCookie(): Promise<string> {
  const res = await fetch('https://www.bilibili.com/', { headers: { 'User-Agent': UA } });
  const raw = res.headers.getSetCookie?.() ?? [];
  const jar = raw.map((c) => c.split(';')[0]).filter(Boolean);
  return jar.join('; ');
}

function toRecord(v: SearchItem): VideoRecord {
  const d = new Date(v.pubdate * 1000);
  const pad = (n: number | string) => String(n).padStart(2, '0');
  // 搜索接口给的是 "6:17" 或 "1:02:33"，补齐成两位，别的地方就不用再处理了
  const duration = v.duration.split(':').map((x) => pad(x.trim())).join(':');
  return {
    bvid: v.bvid,
    // 搜索结果里命中的词被包了 <em class="keyword">，必须剥掉
    title: v.title.replace(/<[^>]+>/g, '').trim(),
    cover: v.pic.startsWith('//') ? `https:${v.pic}` : v.pic.replace(/^http:/, 'https:'),
    date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    duration,
    view: v.play,
    author: v.author,
    mid: v.mid,
  };
}

type SearchOutcome =
  | { kind: 'ok'; items: VideoRecord[] }
  | { kind: 'empty' }
  /** 被风控掐了，整轮应当停下 */
  | { kind: 'banned'; reason: string };

async function search(keyword: string, cookie: string, page: number): Promise<SearchOutcome> {
  const url = `https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=${encodeURIComponent(keyword)}&page=${page}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Referer: 'https://search.bilibili.com/', Cookie: cookie },
  });
  const text = await res.text();
  // 风控时返回的是一张 HTML 页，不是 JSON
  if (!text.startsWith('{')) return { kind: 'banned', reason: '返回了非 JSON（风控页）' };

  const json = JSON.parse(text) as { code: number; message: string; data?: { result?: SearchItem[] } };
  if (json.code === -412 || json.code === -799) return { kind: 'banned', reason: `code=${json.code} ${json.message}` };
  if (json.code !== 0) return { kind: 'empty' };

  const result = json.data?.result ?? [];
  return result.length === 0 ? { kind: 'empty' } : { kind: 'ok', items: result.map(toRecord) };
}

/**
 * 把一个模型的候选视频收齐：每个名字从第一页往后翻，凑够 MAX_PER_MODEL 条就停。
 * 返回 banned 时调用方应当中止整轮。
 */
async function gather(
  names: string[],
  cookie: string,
): Promise<{ candidates: VideoRecord[]; banned: string | null }> {
  const candidates: VideoRecord[] = [];
  let first = true;

  for (const name of names) {
    for (let page = 1; page <= MAX_PAGES; page++) {
      if (!first) await sleep(DELAY_MS);
      first = false;

      const outcome = await search(`${name} ${KEYWORD}`, cookie, page);
      if (outcome.kind === 'banned') return { candidates, banned: outcome.reason };
      if (outcome.kind === 'empty') break;

      candidates.push(...outcome.items);
      if (pickVideos(names, candidates).length >= MAX_PER_MODEL) {
        return { candidates, banned: null };
      }
      if (outcome.items.length < PAGE_SIZE) break;
    }
  }
  return { candidates, banned: null };
}

function readLibrary(): VideoLibrary {
  if (fs.existsSync(OUT)) {
    try {
      const prev = JSON.parse(fs.readFileSync(OUT, 'utf8')) as Partial<VideoLibrary>;
      if (prev.byModel) {
        return {
          fetchedAt: prev.fetchedAt ?? '',
          keyword: KEYWORD,
          authorMid: AUTHOR_MID,
          byModel: prev.byModel,
        };
      }
    } catch {
      // 旧格式或者坏文件：当成没有，下面重新建
    }
  }
  return { fetchedAt: '', keyword: KEYWORD, authorMid: AUTHOR_MID, byModel: {} };
}

function write(lib: VideoLibrary) {
  lib.fetchedAt = new Date().toISOString();
  // byModel 按 key 排序，避免每次刷新都产生一份顺序不同的 diff
  const sorted = Object.fromEntries(Object.entries(lib.byModel).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(OUT, `${JSON.stringify({ ...lib, byModel: sorted }, null, 2)}\n`);
}

async function main() {
  const force = process.argv.includes('--force');
  if (!fs.existsSync(SNAPSHOT)) throw new Error('没有 data/models.json，先跑 npm run sync');
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8')) as WorldSnapshot;

  const lib = readLibrary();
  const targets = targetModels(snapshot);
  const staleBefore = Date.now() - STALE_DAYS * 86_400_000;
  const todo = targets.filter((m) => {
    if (force) return true;
    const got = lib.byModel[m.id];
    return got == null || Date.parse(got.fetchedAt) < staleBefore;
  });

  console.log(
    `[bilibili] 目标 ${targets.length} 个模型（综合智力前 ${TOP_ECI} 或 ${RECENT_DAYS} 天内发布），` +
      `本轮要抓 ${todo.length} 个${force ? '（--force）' : ''}`,
  );
  if (todo.length === 0) {
    console.log('[bilibili] 都还新鲜，没事可做');
    return;
  }

  const cookie = await freshCookie();
  if (!cookie) console.log('[bilibili] 没拿到 buvid3 cookie，搜索可能直接被拒');

  let ok = 0;
  let empty = 0;
  const now = new Date().toISOString();

  for (const [i, m] of todo.entries()) {
    /*
     * 带日期后缀的型号（DeepSeek V4 Flash 0731、Qwen3 235B A22b 2507）要搜两次：
     * 一次全名、一次去掉日期。那串数字是厂商给 API 快照编的号，绝大多数视频不会写，
     * 只搜全名会把整条产品线的实测全漏掉；但偶尔真有人写，只搜短名又会漏掉那一条
     * （词边界规则下 `deepseekv4flash` 后面紧跟 `0731` 不算一个完整的词）。
     * 所以两边都搜、结果合并、两个名字都拿去匹配。
     */
    const base = baseName(m.name);
    const names = base ? [m.name, base] : [m.name];

    const got = await gather(names, cookie);
    if (got.banned) {
      console.log(`[bilibili] 第 ${i + 1} 个（${m.name}）被风控：${got.banned}`);
      console.log('[bilibili] 停下，已抓到的部分保留，过一阵再跑一次即可接着抓');
      break;
    }

    const videos = pickVideos(names, got.candidates);
    // 合并了两次搜索时，标题上显示不带日期的那个名字：列表里多数视频讲的是整条线
    const matchedName = base ?? m.name;

    lib.byModel[m.id] = { fetchedAt: now, videos, ...(matchedName !== m.name ? { matchedName } : {}) };
    if (videos.length > 0) ok += 1;
    else empty += 1;
    // 每个都落盘：被掐断时不丢进度
    write(lib);
    if ((i + 1) % 10 === 0 || i === todo.length - 1) {
      console.log(`  ${i + 1}/${todo.length}  有视频 ${ok}，无 ${empty}`);
    }
    await sleep(DELAY_MS);
  }

  const withVideos = Object.values(lib.byModel).filter((e) => e.videos.length > 0).length;
  const total = Object.values(lib.byModel).reduce((n, e) => n + e.videos.length, 0);
  console.log(`[bilibili] 写入 data/bilibili.json：${withVideos} 个模型有视频，共 ${total} 条`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
