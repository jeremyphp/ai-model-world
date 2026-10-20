import Link from 'next/link';
import { GroundBackdrop } from '@/components/world/Ground';
import { SiteHeader } from '@/components/world/SiteHeader';
import { AffiliateStrip } from '@/components/world/AffiliateStrip';
import { listApps, withUtm, APP_STATUS_META } from '@/lib/apps';
import { DEFAULT_LANG } from '@/lib/i18n';

export const metadata = { title: '应用落地' };

/**
 * 应用落地——把「用这套数据/能力真做出来的东西」摊开。
 *
 * 这里只做目录：每个应用独立部署、独立代码库，主站负责指路。
 * 新增应用只需要往 src/lib/apps.ts 里加一条，页面自动更新。
 */
export default function AppsPage() {
  const lang = DEFAULT_LANG;
  const apps = listApps();
  const liveCount = apps.filter((a) => a.status === 'live').length;

  return (
    <main className="relative min-h-dvh">
      <GroundBackdrop />
      <div className="relative">
        <SiteHeader current="apps" lang={lang} />

        <div className="page-shell pb-16 pt-4">
          <h1 className="pixel-outline mb-2 mt-4 text-2xl sm:text-3xl">应用落地</h1>
          <p className="mb-8 max-w-3xl text-[14px] leading-relaxed text-[var(--color-ghost)]">
            把「看模型」变成「用模型」：这些都是从本站的数据与能力里长出来的小工具，
            每个独立部署、独立收费，点进去就能用。目前 {apps.length} 个（{liveCount} 个已上线），
            后面还会持续加。
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {apps.map((app) => {
              const meta = APP_STATUS_META[app.status];
              return (
                <article key={app.id} className="pixel-panel-dark flex flex-col p-4">
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <h2 className="text-[15px] font-semibold text-[var(--color-parchment)]">{app.name}</h2>
                    <span
                      className="shrink-0 border px-1.5 text-[11px] leading-5"
                      style={{
                        color: meta.color,
                        borderColor: meta.dim ? 'var(--color-stone-dark)' : meta.color,
                        opacity: meta.dim ? 0.8 : 1,
                      }}
                    >
                      {meta.label}
                    </span>
                  </div>

                  <p className="text-[13px] font-medium" style={{ color: 'var(--color-gold)' }}>
                    {app.tagline}
                  </p>
                  <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-[var(--color-ghost)]">{app.desc}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {app.tags.map((t) => (
                      <span
                        key={t}
                        className="border border-[var(--color-stone-dark)] px-1.5 text-[11px] leading-5 text-[var(--color-ghost)]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-[12px] text-[var(--color-ghost)]">上线 {app.launchedAt}</span>
                    <a
                      href={withUtm(app.href)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pixel-button px-3 py-1.5 text-[13px] font-medium text-[var(--color-ink)]"
                    >
                      打开应用 →
                    </a>
                  </div>
                </article>
              );
            })}

            {/* 占位卡：告诉读者这里还会长东西，也提醒自己下一批要做 */}
            <article
              className="flex flex-col justify-center border border-dashed border-[var(--color-stone-dark)] p-4 text-center"
              aria-label="更多应用开发中"
            >
              <p className="text-[14px] font-medium text-[var(--color-parchment)]">下一个应用正在做</p>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-ghost)]">
                有想让我们做的工具？在社区里说一声，呼声高的先做。
              </p>
            </article>
          </div>

          <section className="mt-10" aria-label="关于应用落地">
            <h2 className="mb-2 font-pixel text-[16px] text-[var(--color-parchment)]">这些应用怎么来的</h2>
            <p className="max-w-3xl text-[13px] leading-relaxed text-[var(--color-ghost)]">
              本站先把「哪个模型便宜、哪个模型能干活」用公开评测摆清楚，再挑能力最合适的模型去做具体工具——
              应用里不绑定单一模型，哪个性价比高就换哪个，用户只按结果付费。
            </p>
            <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-ghost)]">
              想第一时间知道新应用：
              <Link href="/welfare/" className="ml-1 underline decoration-dotted underline-offset-2 hover:text-[var(--color-gold)]">
                福利情报
              </Link>
              里会同步播报。
            </p>
          </section>

          <AffiliateStrip />
        </div>
      </div>
    </main>
  );
}
