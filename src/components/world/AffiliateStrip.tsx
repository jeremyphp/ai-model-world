import { AFFILIATES } from '@/data/affiliates';
import { isToyBuild } from '@/lib/outbound';

/**
 * 返佣链接条——详情页、排行榜底部的那一行「API 优惠」。
 *
 * 设计克制：一行 12px 小字 + 一个「广告」标识，不抢正文；
 * Toy 版整块不渲染（B 站审核对站外导流敏感）；
 * 链接 rel="nofollow sponsored"，符合搜索引擎与广告标识的要求。
 */
export function AffiliateStrip() {
  if (isToyBuild()) return null;
  const live = AFFILIATES.filter((a) => a.url.length > 0);
  if (live.length === 0) return null;

  return (
    <div className="mt-10 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] leading-none text-[var(--color-ghost)]">
      <span
        className="border border-[var(--color-gold-dark)] px-1 py-px text-[11px] leading-none"
        style={{ color: 'var(--color-gold-dim)' }}
      >
        广告
      </span>
      <span>API 优惠：</span>
      {live.map((a, i) => (
        <span key={a.id} className="flex items-center gap-2">
          <a
            href={a.url}
            target="_blank"
            rel="nofollow sponsored noopener noreferrer"
            title={a.hint}
            className="underline decoration-dotted underline-offset-2 hover:text-[var(--color-gold)]"
          >
            {a.name}
          </a>
          {i < live.length - 1 && <span aria-hidden>·</span>}
        </span>
      ))}
    </div>
  );
}
