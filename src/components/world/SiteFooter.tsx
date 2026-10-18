import Link from 'next/link';
import { DEFAULT_LANG, getDict } from '@/lib/i18n';
import { outbound } from '@/lib/outbound';

/** 数据源署名。CC-BY 4.0 要求每个展示页都能找到出处，所以放在全站布局里而不是某一页。 */
const DATA_SOURCES = [
  { name: 'Epoch AI', license: 'CC-BY 4.0', href: 'https://epoch.ai/data/ai-benchmarking-dashboard' },
  { name: 'models.dev', license: 'MIT', href: 'https://models.dev' },
  { name: 'LiveBench', license: 'Apache-2.0', href: 'https://livebench.ai' },
  /*
   * 竞技场分来自 LMArena 官方发布的 `lmarena-ai/leaderboard-dataset`（CC-BY 4.0）。
   * 链接指向数据集本身而不是 arena.ai 的榜单页：CC-BY 要求给出**材料**的链接，
   * 而我们用的是那份数据集，不是那个网页。修改声明在致谢页。
   */
  {
    name: 'LMArena',
    license: 'CC-BY 4.0',
    href: 'https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset',
  },
];

/** 角色是本站原创像素画，不在这一行；借用了哪些社区形象写在 /credits/。 */
const ART_SOURCES = [
  {
    name: 'Fusion Pixel Font',
    license: 'OFL-1.1',
    href: 'https://github.com/TakWolf/fusion-pixel-font',
  },
];

/** 站长署名。链到 GitHub 主页——本站不再挂第三方站点的引流按钮，页脚只留自己的身份。 */
const AUTHOR = { name: 'jeremy', href: 'https://github.com/jeremyphp' };

/**
 * 开源仓库（本站自己的 fork）。
 *
 * 放在页脚下半段的署名区，与数据源、美术素材并排，而不是挤进上面那排——
 * 这里的三行本来就是在回答「这些东西都是哪来的」，「代码本身也是公开的」正好是同一个问题的最后一问。
 */
const REPO = { name: 'jeremyphp/ai-model-world', href: 'https://github.com/jeremyphp/ai-model-world' };

/**
 * 上游项目。
 *
 * 本项目是 liyupi/ai-model-world 的二次开发。MIT 协议只要求源码保留版权声明，
 * 不强制页脚署名；但把来源写清楚既是履约，也是不让读者误以为完全原创。
 */
const UPSTREAM = { name: 'liyupi/ai-model-world', href: 'https://github.com/liyupi/ai-model-world' };

/** 一条像素小鱼，站长的徽记 */
function FishCrest({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      shapeRendering="crispEdges"
      aria-hidden
      className="shrink-0"
    >
      <rect x="3" y="3" width="6" height="6" fill="var(--color-gold)" />
      <rect x="2" y="4" width="1" height="4" fill="var(--color-gold)" />
      <rect x="4" y="2" width="4" height="1" fill="var(--color-gold)" />
      <rect x="4" y="9" width="4" height="1" fill="var(--color-gold)" />
      <rect x="9" y="4" width="1" height="1" fill="var(--color-gold)" />
      <rect x="9" y="7" width="1" height="1" fill="var(--color-gold)" />
      <rect x="10" y="3" width="1" height="1" fill="var(--color-gold)" />
      <rect x="10" y="8" width="1" height="1" fill="var(--color-gold)" />
      <rect x="10" y="5" width="1" height="2" fill="var(--color-gold)" />
      <rect x="4" y="4" width="1" height="1" fill="var(--color-ink)" />
      <rect x="6" y="6" width="2" height="1" fill="var(--color-ink)" opacity="0.4" />
    </svg>
  );
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  if (!outbound(href)) return <span className="text-[var(--color-parchment)]">{children}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[var(--color-parchment)] underline decoration-dotted underline-offset-2 hover:text-[var(--color-gold)]"
    >
      {children}
    </a>
  );
}

/**
 * 全站页脚：数据与美术的出处。
 *
 * 这不是装饰。Epoch 与 LMArena 的 CC-BY 是「署名即可用」的许可，
 * 署名做在每一页的页脚是最稳妥的履约方式——读者截任何一页的图，出处都在。
 * 角色形象借用了哪些社区设定放在 /credits/ 单页，这里只给入口。
 */
export function SiteFooter() {
  const dict = getDict(DEFAULT_LANG);
  return (
    <footer className="relative mt-12 border-t border-white/10 bg-black/40">
      <div className="mx-auto max-w-6xl px-4 py-5 text-[12px] leading-relaxed text-[var(--color-ghost)] sm:px-8">
        {/*
          站长署名。做成一排像素按钮而不是一行小字：这是全站唯一的身份位，得让人看见；
          但只占一行，不抢正文。不再挂第三方站点的引流按钮。
        */}
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-white/10 pb-4">
          <a
            href={AUTHOR.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 font-pixel text-[13px] text-[var(--color-parchment)] hover:text-[var(--color-gold)]"
          >
            <FishCrest />
            {dict.footer.author}：{AUTHOR.name}
          </a>
        </div>

        <div className="flex flex-wrap gap-x-1.5 gap-y-1">
          <span>{dict.footer.dataFrom}</span>
          {DATA_SOURCES.map((s, i) => (
            <span key={s.name}>
              <ExtLink href={s.href}>{s.name}</ExtLink>
              <span className="opacity-70">（{s.license}）</span>
              {i < DATA_SOURCES.length - 1 && <span className="mx-1 opacity-50">·</span>}
            </span>
          ))}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-1.5 gap-y-1">
          <span>{dict.footer.artFrom}</span>
          {ART_SOURCES.map((s, i) => (
            <span key={s.name}>
              <ExtLink href={s.href}>{s.name}</ExtLink>
              <span className="opacity-70">（{s.license}）</span>
              {i < ART_SOURCES.length - 1 && <span className="mx-1 opacity-50">·</span>}
            </span>
          ))}
          <span className="mx-1 opacity-50">·</span>
          <Link
            href="/credits/"
            className="text-[var(--color-parchment)] underline decoration-dotted underline-offset-2 hover:text-[var(--color-gold)]"
          >
            {dict.footer.credits}
          </Link>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-1.5 gap-y-1" title={dict.footer.sourceCodeHint}>
          <span>{dict.footer.sourceCode}</span>
          <ExtLink href={REPO.href}>{REPO.name}</ExtLink>
          <span className="opacity-70">（MIT）</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-1.5 gap-y-1">
          <span>{dict.footer.basedOn}</span>
          <ExtLink href={UPSTREAM.href}>{UPSTREAM.name}</ExtLink>
        </div>
      </div>
    </footer>
  );
}
