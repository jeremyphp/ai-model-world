import Link from 'next/link';
import type { Champion } from '@/lib/champions';
import { profileFor } from '@/data/vendor-registry';
import { readableOnDark } from '@/lib/color';
import { getDict, type Lang } from '@/lib/i18n';
import { VendorCrest } from '@/components/character/VendorCrest';
import { SectionFrame } from '@/components/world/SectionFrame';
import { asset } from '@/lib/asset';

/**
 * 首屏「今日格局」：一排领奖台。
 *
 * 这是整个站最先被看到的东西，所以它的任务只有一个——不用滚动、不用点击、
 * 不用读说明，三秒内回答「现在谁最强、谁最会编程、谁最便宜」。
 * 每座台上站一个角色，头顶一块头衔牌，脚下一个大数字。
 *
 * 它取代了早先那条「怎么看这些屋子」的图例：与其教用户读图，
 * 不如直接把读图的结论摆出来。
 */

const SHEET_COLUMNS = 9;
const FIGURE = 64;

function Figure({ slug, accent, hasSprite }: { slug: string; accent: string; hasSprite: boolean }) {
  if (!hasSprite) {
    return (
      <div
        className="anim-idle"
        style={{ width: FIGURE * 0.4, height: FIGURE * 0.7, background: accent }}
        aria-hidden
      />
    );
  }
  return (
    <div
      className="anim-idle"
      style={{
        width: FIGURE,
        height: FIGURE,
        backgroundImage: `url(${asset(`/sprites/${slug}.png`)})`,
        backgroundSize: `${FIGURE * SHEET_COLUMNS}px auto`,
        backgroundPosition: '0 0',
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
      }}
      aria-hidden
    />
  );
}

export function ChampionRow({
  champions,
  lang,
  spriteSlugs,
}: {
  champions: Champion[];
  lang: Lang;
  spriteSlugs: ReadonlySet<string>;
}) {
  const dict = getDict(lang);
  if (champions.length === 0) return null;

  return (
    <section aria-labelledby="section-champions" className="relative">
      {/* 标题旁不放任何解释性文字：口径写在每张卡的悬停提示与详情页里，标题就只是标题 */}
      <header className="mb-3 px-1">
        <h2
          id="section-champions"
          className="scroll-mt-4 font-pixel text-[18px] leading-none tracking-wide text-[var(--color-gold)]"
        >
          {dict.champions.title}
        </h2>
      </header>

      {/*
        外框与下面「按类型看」「国外 / 国内」同一套，见 SectionFrame。
        这样首页从上到下是几个同构的块，而不是一排排孤零零的卡片。
        卡片本身不再各带霓虹线——八条一起亮太吵，光留给外框。
      */}
      <SectionFrame
        accent="var(--color-gold)"
        tint="linear-gradient(180deg, rgb(242 207 106 / 0.07), transparent 240px)"
      >
        {/*
          窄屏横向滑动；平板两行四张；1280 以上一行八张。
          名字允许折两行，绝不截断——一张写着「DeepSeek V4 Fla…」的冠军卡等于没写。
          一行八张时每张约 170px，像素字体 14px 下 22 个半角字符正好一行，再长就折到第二行。
        */}
        <div className="-mx-2 flex snap-x gap-3 overflow-x-auto px-2 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 md:grid-cols-4 xl:grid-cols-8 xl:gap-2">
        {champions.map((c) => {
          const profile = profileFor(c.model.vendorId);
          const accent = readableOnDark(profile.accentColor, 0.42);
          return (
            <Link
              key={c.key}
              href={`/model/${c.model.slug}/`}
              className="group relative w-[200px] shrink-0 snap-start outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-gold)] sm:w-auto"
              title={`${c.model.name} · ${c.detail}`}
            >
              <div
                className="pixel-panel-dark flex h-full flex-col items-center px-2 pb-3 pt-2 transition-transform duration-150 group-hover:-translate-y-1"
                style={{ ['--bob-delay' as string]: `${(c.key.length % 5) * 0.37}s` }}
              >
                {/* 头衔牌 */}
                <div className="mb-1 border border-black/50 bg-[var(--color-gold)] px-2 py-px text-[13px] font-semibold leading-tight text-[var(--color-ink)]">
                  {dict.champions[c.key]}
                </div>

                {/* 角色与领奖台 */}
                <div className="relative flex h-[68px] w-full items-end justify-center">
                  {/* 王者荣耀风的金色领奖台：下金上暗的台座 + 顶部高光 */}
                  <div
                    className="absolute bottom-0 h-2 w-[70%]"
                    style={{
                      background: 'linear-gradient(180deg, var(--color-gold) 0 2px, var(--color-gold-dark) 2px 60%, rgb(0 0 0 / 0.5) 60%)',
                      boxShadow: '0 0 10px -2px var(--color-gold)',
                    }}
                    aria-hidden
                  />
                  <Figure
                    slug={c.model.slug}
                    accent={accent}
                    hasSprite={spriteSlugs.has(c.model.slug)}
                  />
                  {c.rank != null && c.rank <= 10 && (
                    <span className="absolute right-0 top-0 font-pixel text-[13px] text-[var(--color-gold)]">
                      #{c.rank}
                    </span>
                  )}
                </div>

                {/* 名字：允许两行，固定两行高度，保证一排卡片底边齐 */}
                <div className="mt-2 flex min-h-[36px] w-full items-center justify-center text-center font-pixel text-[14px] leading-[1.3] text-[var(--color-parchment)] group-hover:text-[var(--color-gold)]">
                  {c.model.name}
                </div>
                <div
                  className="mt-0.5 flex max-w-full items-center gap-1 text-[13px] leading-tight"
                  style={{ color: accent }}
                >
                  <VendorCrest
                    motif={profile.motif}
                    accentColor={profile.accentColor}
                    size={12}
                    title={profile.nameZh}
                  />
                  <span className="truncate">{profile.nameZh}</span>
                </div>
                <div className="mt-2 font-pixel text-[18px] leading-none text-[var(--color-gold)]">
                  {c.figure}
                </div>
                <div className="mt-1.5 line-clamp-2 w-full text-center text-[12px] leading-[1.4] text-[var(--color-ghost)]">
                  {c.detail}
                </div>
              </div>
            </Link>
          );
        })}
        </div>
      </SectionFrame>
    </section>
  );
}
