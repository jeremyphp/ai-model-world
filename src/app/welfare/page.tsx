import Link from 'next/link';
import { GroundBackdrop } from '@/components/world/Ground';
import { SiteHeader } from '@/components/world/SiteHeader';
import { AffiliateStrip } from '@/components/world/AffiliateStrip';
import { buildPriceRadar } from '@/lib/welfare';
import { REBATES, WELFARE_NEWS } from '@/data/welfare';
import { loadSnapshot } from '@/lib/snapshot';
import { DEFAULT_LANG } from '@/lib/i18n';
import { formatPrice } from '@/lib/format';

export const metadata = { title: '福利情报' };

/**
 * 福利情报——网站的「每日收入」引擎。
 *
 * 三个栏目分工明确：
 *   - API 价格雷达：全自动，从 models.json 快照算最便宜的调用渠道，每 12h 随 sync 刷新；
 *   - 返佣福利榜：人工核实过的事实（数字、条件、复核日期），随部署更新；
 *   - 免费额度播报：时间线式的福利动态，新条目置顶，过期条目标注「已结束」。
 *
 * 本站的变现闭环就在这里：读者为了省钱/薅羊毛而来，点返佣链接注册，平台返佣进账。
 * 数字必须真实——夸大或过期的「送钱」承诺会同时毁掉信任和联盟账号。
 */
export default function WelfarePage() {
  const lang = DEFAULT_LANG;
  const snapshot = loadSnapshot();
  const radar = buildPriceRadar(snapshot.models, snapshot.vendors);

  return (
    <main className="relative min-h-dvh">
      <GroundBackdrop />
      <div className="relative">
        <SiteHeader current="welfare" lang={lang} />

        <div className="page-shell pb-16 pt-4">
          <h1 className="pixel-outline mb-2 mt-4 text-2xl sm:text-3xl">福利情报</h1>
          <p className="mb-8 text-[14px] leading-relaxed text-[var(--color-ghost)]">
            每天自动更新的 AI 省钱情报：哪家调模型最便宜、哪家送额度、哪家返佣高。价格数据每 12
            小时从 {snapshot.models.length} 个模型的快照重算；福利数字人工核实并标注复核日期。
          </p>

          {/* ── API 价格雷达 ─────────────────────────────────────── */}
          <section aria-label="API 价格雷达">
            <h2 className="mb-1 font-pixel text-[16px] text-[var(--color-parchment)]">
              API 价格雷达
            </h2>
            <p className="mb-4 text-[13px] leading-relaxed text-[var(--color-ghost)]">
              同一个模型在不同平台差价可达数倍。每个家族按输入价从低到高列出前五档——第一档就是当前最便宜的调用渠道。
              价格为美元/百万 tokens，数据自动同步。
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              {radar.map((fam) => (
                <div key={fam.key} className="pixel-panel-dark p-4">
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <h3 className="text-[15px] font-semibold text-[var(--color-parchment)]">{fam.label}</h3>
                    <span className="text-[12px] text-[var(--color-ghost)]">{fam.blurb}</span>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {fam.offers.map((o, i) => (
                      <li key={o.modelId} className="flex items-baseline justify-between gap-2 text-[13px] leading-relaxed">
                        <span className="min-w-0 truncate" title={`${o.vendorZh} · ${o.name}`}>
                          {i === 0 && (
                            <span className="mr-1 border border-[var(--color-gold-dark)] px-1 text-[11px] leading-none" style={{ color: 'var(--color-gold-dim)' }}>
                              最低
                            </span>
                          )}
                          <Link
                            href={`/model/${o.slug}/`}
                            className="hover:text-[var(--color-gold)]"
                            style={{ color: i === 0 ? 'var(--color-gold)' : 'var(--color-parchment)' }}
                          >
                            {o.vendorZh}
                          </Link>
                          <span className="text-[var(--color-ghost)]"> · {o.name}</span>
                        </span>
                        <span className="shrink-0 text-[var(--color-ghost)]">
                          入 {formatPrice(o.input, lang).replace(' / 百万 tokens', '')} / 出{' '}
                          {formatPrice(o.output, lang).replace(' / 百万 tokens', '')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* ── 返佣福利榜 ───────────────────────────────────────── */}
          <section className="mt-10" aria-label="返佣福利榜">
            <h2 className="mb-1 font-pixel text-[16px] text-[var(--color-parchment)]">返佣福利榜</h2>
            <p className="mb-4 text-[13px] leading-relaxed text-[var(--color-ghost)]">
              按「到手金额 / 条件松紧」人工筛选的返佣计划。带「广告」标的链接走返佣归因；数字均经核实，复核日期见每条末尾。
            </p>

            <div className="space-y-3">
              {REBATES.map((r) => (
                <div key={r.id} className="pixel-panel-dark flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 p-4">
                  <div className="min-w-0">
                    <span className="text-[14px] font-semibold text-[var(--color-parchment)]">{r.name}</span>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--color-parchment)]">{r.reward}</p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--color-ghost)]">
                      {r.condition} · 复核于 {r.checkedAt}
                    </p>
                  </div>
                  <a
                    href={r.url}
                    target="_blank"
                    rel={r.affiliate ? 'nofollow sponsored noopener noreferrer' : 'nofollow noopener noreferrer'}
                    className="pixel-button shrink-0 px-3 py-1.5 text-[13px] font-medium text-[var(--color-ink)]"
                  >
                    {r.affiliate ? '广告 · 去领取' : '去了解'} →
                  </a>
                </div>
              ))}
            </div>
          </section>

          {/* ── 免费额度播报 ─────────────────────────────────────── */}
          <section className="mt-10" aria-label="免费额度播报">
            <h2 className="mb-4 font-pixel text-[16px] text-[var(--color-parchment)]">免费额度播报</h2>
            <ol className="relative border-l-2 border-[var(--color-stone-dark)] pl-5 sm:pl-7">
              {WELFARE_NEWS.map((n) => (
                <li key={`${n.date}-${n.title}`} className="relative mb-5">
                  <span
                    className="absolute top-1.5 block h-2 w-2 bg-[var(--color-gold)]"
                    style={{ left: -27, boxShadow: '0 0 6px rgb(242 207 106 / 0.4)' }}
                    aria-hidden
                  />
                  <span className="text-[12px] text-[var(--color-ghost)]">{n.date}</span>
                  <h3 className="text-[14px] font-semibold text-[var(--color-parchment)]">{n.title}</h3>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--color-ghost)]">
                    {n.text}
                    {n.link && (
                      <>
                        {' '}
                        <a
                          href={n.link}
                          target="_blank"
                          rel="nofollow noopener noreferrer"
                          className="underline decoration-dotted underline-offset-2 hover:text-[var(--color-gold)]"
                        >
                          官方详情
                        </a>
                      </>
                    )}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <AffiliateStrip />
        </div>
      </div>
    </main>
  );
}
