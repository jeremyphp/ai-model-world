import fs from 'node:fs';
import path from 'node:path';
import type { VideoLibrary } from './videos';

/**
 * 读取 `data/bilibili.json`（由 `npm run bilibili` 生成并提交进仓库）。
 *
 * 与 `snapshot.ts` 的区别：**这个文件缺失不算错误**。模型数据缺了页面就没内容，
 * 必须硬失败；视频只是锦上添花，B 站哪天封了接口、或者有人 clone 了仓库还没跑过
 * `npm run bilibili`，站点都该照常构建，只是详情页少一块。
 */

const EMPTY: VideoLibrary = { fetchedAt: '', keyword: '测评', authorMid: 0, byModel: {} };

let cache: VideoLibrary | null = null;

export function loadVideoLibrary(): VideoLibrary {
  if (cache && process.env.NODE_ENV === 'production') return cache;
  const file = path.join(process.cwd(), 'data', 'bilibili.json');
  let out = EMPTY;
  try {
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<VideoLibrary>;
      if (parsed.byModel) out = { ...EMPTY, ...parsed, byModel: parsed.byModel };
    }
  } catch {
    out = EMPTY;
  }
  cache = out;
  return out;
}
