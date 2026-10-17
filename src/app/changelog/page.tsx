import Link from 'next/link';
import { GroundBackdrop } from '@/components/world/Ground';
import { SiteHeader } from '@/components/world/SiteHeader';
import { loadChangelog, siteUrl } from '@/lib/changelog';
import { DEFAULT_LANG } from '@/lib/i18n';

export const metadata = { title: '更新日志' };

/**
 * 更新日志。
 *
 * 数据来自 data/changelog.json——sync 工作流每次同步后比较新旧快照自动生成，
 * 本站不写一个字：新模型、退役、门面换代、冠军易主四类，全部由数据说话。
 * 同一份文件也喂给 RSS（/changelog.rss）和 GitHub 的「模型更新速报」issue。
 */

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function ChangelogPage() {
  const entries = loadChangelog();

  return (
    <main className="relative min-h-dvh">
      <GroundBackdrop />
      <div className="relative">
        <SiteHeader current="changelog" lang={DEFAULT_LANG} />

        <div className="page-shell pb-16 pt-4">
          <div className="mb-4 mt-4 flex flex-wrap items-baseline justify-between gap-3">
            <h1 className="pixel-outline text-2xl sm:text-3xl">更新日志</h1>
            <a
              href={`${siteUrl()}/changelog.rss`}
              className="pixel-button px-3 py-1.5 text-[13px] font-medium text-[var(--color-ink)]"
            >
              RSS 订阅
            </a>
          </div>
          <p className="mb-8 text-[14px] leading-relaxed text-[var(--color-ghost)]">
            数据管线每 12 小时自动同步一次，模型世界里值得注意的变化都会记录在这里。想第一时间收到，订阅 RSS
            或 Watch GitHub 仓库的「模型更新速报」issue。
          </p>

          {entries.length === 0 ? (
            <div className="pixel-panel-dark p-6 text-[14px] text-[var(--color-parchment)]">
              还没有更新记录。本地开发模式下 data/changelog.json 只有在跑过
              <code className="mx-1 bg-[rgb(0_0_0/0.3)] px-1">npm run sync</code>
              并检测到变化之后才会生成；部署到 Vercel 后由定时工作流自动维护。
            </div>
          ) : (
            <ol className="relative border-l-2 border-[var(--color-stone-dark)] pl-5 sm:pl-7">
              {entries.map((e) => (
                <li key={e.date} className="relative mb-10">
                  <span
                    className="absolute top-2 block h-2.5 w-2.5 bg-[var(--color-gold)]"
                    style={{ left: -27, boxShadow: '0 0 8px rgb(242 207 106 / 0.45)' }}
                    aria-hidden
                  />
                  <h2 className="font-pixel text-[16px] leading-none text-[var(--color-parchment)]">
                    {fmtDate(e.date)}
                  </h2>

                  <div className="mt-3 space-y-4">
                    {e.champions.length > 0 && (
                      <section>
                        <h3 className="mb-1.5 text-[13px] font-semibold text-[var(--color-gold)]">
                          冠军易主
                        </h3>
                        <ul className="space-y-1">
                          {e.champions.map((c) => (
                            <li key={c.key} className="text-[14px] leading-relaxed text-[var(--color-parchment)]">
                              <span className="text-[var(--color-gold)]">{c.label}</span>
                              <span className="text-[var(--color-ghost)]">：{c.before} → </span>
                              <Link
                                href={`/model/${c.slug}/`}
                                className="underline decoration-dotted underline-offset-2 hover:text-[var(--color-gold)]"
                              >
                                {c.after}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}

                    {e.flagships.length > 0 && (
                      <section>
                        <h3 className="mb-1.5 text-[13px] font-semibold text-[var(--color-parchment)]">
                          门面换代
                        </h3>
                        <ul className="space-y-1">
                          {e.flagships.map((f) => (
                            <li key={f.vendorId} className="text-[14px] leading-relaxed text-[var(--color-parchment)]">
                              <span className="text-[var(--color-ghost)]">{f.vendorZh}：{f.before} → </span>
                              <Link
                                href={`/model/${f.slug}/`}
                                className="underline decoration-dotted underline-offset-2 hover:text-[var(--color-gold)]"
                              >
                                {f.after}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}

                    {e.newVendors.length > 0 && (
                      <section>
                        <h3 className="mb-1.5 text-[13px] font-semibold text-[var(--color-parchment)]">
                          新厂商（{e.newVendors.length}）
                        </h3>
                        <p className="text-[14px] leading-relaxed text-[var(--color-parchment)]">
                          {e.newVendors.map((v) => v.nameZh).join(' · ')}
                        </p>
                      </section>
                    )}

                    {e.newModels.length > 0 && (
                      <section>
                        <h3 className="mb-1.5 text-[13px] font-semibold text-[var(--color-parchment)]">
                          新模型（{e.newModels.length}）
                        </h3>
                        <ul className="flex flex-wrap gap-2">
                          {e.newModels.map((m) => (
                            <li key={m.id}>
                              <Link
                                href={`/model/${m.slug}/`}
                                className="inline-block border-2 border-[var(--color-ink)] px-2.5 py-1 text-[13px] leading-none hover:border-[var(--color-gold)]"
                                style={{ background: 'var(--color-plate)', color: 'var(--color-parchment)' }}
                                title={m.vendorZh}
                              >
                                {m.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}

                    {e.retired.length > 0 && (
                      <section>
                        <h3 className="mb-1.5 text-[13px] font-semibold text-[var(--color-ghost)]">
                          退役（{e.retired.length}）
                        </h3>
                        <p className="text-[14px] leading-relaxed text-[var(--color-ghost)]">
                          {e.retired.map((m) => m.name).join(' · ')}
                        </p>
                      </section>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </main>
  );
}
