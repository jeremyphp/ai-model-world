/**
 * 应用落地项目登记表。
 *
 * 主站只做「目录」，每个应用是独立部署的（各自域名、各自代码库），
 * 这里只维护列表与入口链接——新增应用时**只改这个文件**，不用动页面。
 *
 * 字段约定：
 *   - id：稳定标识，用于锚点与 React key，不要随文案改
 *   - name / tagline / desc：列表卡片上的三行文案（tagline 一行，desc 两行内）
 *   - href：线上地址（外链，独立域名）
 *   - tags：能力标签，2–3 个最佳
 *   - status：live = 已上线；beta = 内测；wip = 开发中
 *   - launchedAt：上线日期（YYYY-MM-DD），列表按它倒序
 *   - accent：卡片强调色（CSS 变量名），避免新增应用时还要改样式
 */

export type AppStatus = 'live' | 'beta' | 'wip';

export interface AppEntry {
  id: string;
  name: string;
  tagline: string;
  desc: string;
  href: string;
  tags: string[];
  status: AppStatus;
  launchedAt: string;
  accent?: 'gold' | 'jade' | 'violet';
}

/** 状态对应的中文标签与色值（色值走 CSS 变量，见 globals.css 的 color 定义） */
export const APP_STATUS_META: Record<AppStatus, { label: string; color: string; dim: boolean }> = {
  live: { label: '已上线', color: 'var(--color-jade, #4ade80)', dim: false },
  beta: { label: '内测', color: 'var(--color-gold)', dim: false },
  wip: { label: '开发中', color: 'var(--color-ghost)', dim: true },
};

export const APPS: AppEntry[] = [
  {
    id: 'wuliao',
    name: 'AI 物料工坊',
    tagline: '一句话出图，直接进印刷厂',
    desc: '输入主题生成吧唧 / 立牌 / 小卡设计图，自动套出血线与裁切线，导出 300dpi CMYK TIFF；支持去背刀模、中文排版（4 字体 / 竖排 / 描边 / 底条）。',
    href: 'https://wuliao.aimodle.cn',
    tags: ['AI 出图', '印刷文件', '去背刀模'],
    status: 'live',
    launchedAt: '2026-10-19',
    accent: 'gold',
  },
];

/** 按上线时间倒序（新的在前），列表页与首页都用这个顺序 */
export function listApps(): AppEntry[] {
  return [...APPS].sort((a, b) => (a.launchedAt < b.launchedAt ? 1 : -1));
}
