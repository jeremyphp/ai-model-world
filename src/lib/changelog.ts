/**
 * 读取 data/changelog.json 的更新日志。
 *
 * 文件由 sync 工作流在每次数据同步后生成（scripts/sync/changelog.ts），
 * 站点 /changelog/ 页与 RSS 读同一份文件；**文件缺失不算错误**——
 * 本地开发还没跑过带变更日志的 sync 时就是空列表，页面显示一条占位说明。
 */

import fs from 'node:fs';
import path from 'node:path';
import type { ChangeEntry } from './types';

const FILE = path.join(process.cwd(), 'data/changelog.json');

export function loadChangelog(): ChangeEntry[] {
  try {
    const raw = fs.readFileSync(FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ChangeEntry[];
  } catch {
    return [];
  }
}

/** RSS / issue 用的站点根地址。部署到正式域名后改 Vercel 环境变量 NEXT_PUBLIC_SITE_URL 即可。 */
export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'https://aimodle.cn';
}
