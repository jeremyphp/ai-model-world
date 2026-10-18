import { CompareButton } from '@/components/compare/CompareButton';
import { getDict, type Lang } from '@/lib/i18n';

/**
 * B 站搜索页。搜索词由模型名现算，所以新模型上线当天这个按钮就是通的，
 * 不需要维护「模型 → 视频」的对应表，也不需要抓取、存储任何站外内容。
 */
function bilibiliSearch(modelName: string): string {
  return `https://search.bilibili.com/all?keyword=${encodeURIComponent(`${modelName} 测评`)}`;
}

function PlayIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" shapeRendering="crispEdges" aria-hidden>
      <rect x="1" y="2" width="10" height="8" fill="currentColor" opacity="0.25" />
      <rect x="4" y="4" width="1" height="4" fill="currentColor" />
      <rect x="5" y="5" width="1" height="2" fill="currentColor" />
      <rect x="6" y="5" width="1" height="2" fill="currentColor" />
      <rect x="7" y="6" width="1" height="1" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

/**
 * 站外深链接，跟在一句话定位后面。
 *
 * 不给它单开一节：那一节里除了按钮什么都没有，标题与免责声明加起来比按钮还长，
 * 等于用一整块版面说「这里没内容」。本站只出门、不搬运——中文的模型评价散在视频与
 * 个人博客里，既没有可复用的许可，也没有能自动核对的结构，抓过来会同时破坏
 * 「每个数字有出处」和「零人工维护」两条底线。做成深链接后，新模型无需任何同步
 * 就自带入口，读者点出去看的是原始出处。
 *
 * 只有一个 B 站搜索按钮：原先还有个「查看评测文章」指向第三方导航站的固定页，
 * 那条既不可维护也不该给别家导流，已下线。
 */
export function ReviewLinks({ modelName, slug, lang }: { modelName: string; slug: string; lang: Lang }) {
  const dict = getDict(lang);
  const cls =
    'pixel-button flex items-center gap-1.5 px-2 py-0.5 text-[12px] leading-tight text-[var(--color-ink)] hover:bg-[var(--color-gold)]';
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {/* 站内的动作排在出站链接前面 */}
      <CompareButton slug={slug} className={cls} />
      <a
        href={bilibiliSearch(modelName)}
        target="_blank"
        rel="noopener noreferrer"
        title={dict.reviews.videoHint(modelName)}
        className={cls}
      >
        <PlayIcon />
        {dict.reviews.video}
      </a>
    </div>
  );
}
