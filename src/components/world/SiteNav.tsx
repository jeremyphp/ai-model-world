import Link from 'next/link';
import { getDict, type Lang } from '@/lib/i18n';
import { GlobalSearch } from './GlobalSearch';

/**
 * 全站导航。
 *
 * 当前页由调用方以 prop 传入而不是在客户端读 location——
 * 这个站是纯静态导出，能不发一行 JavaScript 到客户端就不发。
 */

/*
 * 「已退役」页曾是第四个入口，后来撤掉：退役模型在排行榜的「含已退役」筛选和详情页里都能看到，
 * 单独一页对读者没有增量信息。
 */
export type NavKey = 'plaza' | 'chronicle' | 'leaderboard' | 'compare' | 'changelog' | 'welfare';

const ITEMS: { key: NavKey; href: string }[] = [
  { key: 'plaza', href: '/' },
  { key: 'chronicle', href: '/chronicle/' },
  { key: 'leaderboard', href: '/leaderboard/' },
  { key: 'compare', href: '/compare/' },
  { key: 'welfare', href: '/welfare/' },
  { key: 'changelog', href: '/changelog/' },
];

/** `current` 为 null 表示不在三个主页面里（如素材署名页），导航照常显示但无高亮 */
export function SiteNav({ current, lang }: { current: NavKey | null; lang: Lang }) {
  const dict = getDict(lang);
  return (
    <nav
      aria-label="主导航"
      // 窄屏整条占满：搜索框要跟着撑开，否则它的结果面板挂在一个两百像素宽的锚点上，会溢出屏幕左边
      className="relative z-10 flex w-full flex-wrap items-center justify-center gap-1.5 px-0 py-2 sm:w-auto sm:gap-2"
    >
      {/*
        搜索框在三个按钮左边。它是入口里最宽的一个，放右边会把导航推得忽长忽短，
        而且读者的阅读顺序是从左开始——「先想去哪，找不到再点固定入口」。
      */}
      <GlobalSearch />
      {ITEMS.map((item) => {
        const active = item.key === current;
        return (
          <Link
            key={item.key}
            href={item.href}
            // 当前页只用 aria-current。aria-pressed 是给切换按钮的，
            // 放在链接上会让读屏软件把导航念成一排「已按下」的开关。
            aria-current={active ? 'page' : undefined}
            className="pixel-button px-2.5 py-1.5 text-[13px] font-medium text-[var(--color-ink)] sm:px-3"
          >
            {dict.nav[item.key]}
          </Link>
        );
      })}
    </nav>
  );
}
