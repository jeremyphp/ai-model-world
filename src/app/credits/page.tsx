import { GroundBackdrop } from '@/components/world/Ground';
import { SiteHeader } from '@/components/world/SiteHeader';
import { DEFAULT_LANG, getDict } from '@/lib/i18n';
import { outbound } from '@/lib/outbound';

export const metadata = { title: '素材署名' };

/**
 * 素材署名页。
 *
 * 角色是本项目逐像素手绘的原创像素画（`scripts/sprites/chibi/`），不含第三方美术素材；
 * 但有一部分形象借用了社区里已经流传开的娘化设定，这里写明出处。
 * 这张表与 `scripts/sprites/chibi/designs.ts` 里 `basis` 为 community / official 的条目一一对应，
 * 改那边的时候同步改这里。
 */

const CHARACTER_SOURCES: { who: string; basis: string; href?: string }[] = [
  {
    who: 'GPT 酱、GPT Image 娘、Claude 娘、Gemini 娘',
    basis: 'linux.do 社区「AI娘们的互动小剧场」系列里的形象',
    href: 'https://linux.do/t/topic/2052255',
  },
  { who: 'DeepSeek 鲸鱼娘', basis: '社区二创形象「DeepSeek娘」', href: 'https://zh.moegirl.org.cn/DeepSeek%E5%A8%98' },
  { who: '智谱 Z 狐娘', basis: '社区流传的 Z.ai 黑狐娘形象' },
  { who: 'Grok 娘', basis: 'xAI 在 Grok 里推出的官方二次元形象' },
  { who: '豆包', basis: '字节跳动豆包的官方 3D 形象' },
];

const LMARENA_DATASET = 'https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset';

const UPSTREAM_REPO = 'https://github.com/liyupi/ai-model-world';

export default function CreditsPage() {
  const lang = DEFAULT_LANG;
  const dict = getDict(lang);

  return (
    <main className="relative min-h-dvh">
      <GroundBackdrop />
      <div className="relative">
        <SiteHeader current={null} lang={lang} narrow />

        <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-4 sm:px-8">
          <h1 className="pixel-outline mb-2 mt-4 text-2xl sm:text-3xl">{dict.footer.credits}</h1>

          {/*
            项目来源声明。MIT 只要求源码保留版权声明，这里再写一遍是诚实起见：
            本站是二次开发，不是从零开始的原创项目，读者有权知道这一点。
          */}
          <section className="pixel-panel-dark mb-6 p-4">
            <h2 className="mb-2 font-pixel text-[14px] text-[var(--color-gold)]">项目来源</h2>
            <p className="text-[13px] leading-relaxed text-[var(--color-parchment)]">
              本站基于{' '}
              {outbound(UPSTREAM_REPO) ? (
                <a
                  href={UPSTREAM_REPO}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-dotted underline-offset-2 hover:text-[var(--color-gold)]"
                >
                  liyupi/ai-model-world
                </a>
              ) : (
                'liyupi/ai-model-world'
              )}{' '}
              二次开发，按 MIT 协议使用。数据管线、角色形象与页面结构源自上游，本站对其做了主题重制、
              功能扩展（福利情报、更新日志）与价格数据的重新组织；原版权归原作者所有。
            </p>
          </section>

          <section className="pixel-panel-dark mb-6 p-4">
            <h2 className="mb-2 font-pixel text-[14px] text-[var(--color-gold)]">角色形象</h2>
            <p className="mb-2 text-[13px] leading-relaxed text-[var(--color-parchment)]">
              全部角色都是本站手绘的原创像素画，披风、铠甲与武器同样为本项目原创绘制。
              没有公认娘化形象的厂商，按它的标志与品牌色设计；
              发饰上的标志是像素化的改写，只用于辨认，商标归各自所有者。下面这些形象借用了已有的设定：
            </p>
            <ul className="space-y-1 text-[13px] leading-relaxed text-[var(--color-parchment)]">
              {CHARACTER_SOURCES.map((c) => (
                <li key={c.who}>
                  {c.who}：
                  {outbound(c.href) ? (
                    <a
                      href={c.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline decoration-dotted underline-offset-2 hover:text-[var(--color-gold)]"
                    >
                      {c.basis}
                    </a>
                  ) : (
                    c.basis
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="pixel-panel-dark mb-6 p-4">
            <h2 className="mb-2 font-pixel text-[14px] text-[var(--color-gold)]">数据</h2>
            <ul className="space-y-1 text-[13px] leading-relaxed text-[var(--color-parchment)]">
              <li>
                评测成绩：Epoch AI《AI Benchmarking Hub》，CC-BY 4.0。本站按榜单分列展示，不做跨榜混算。
              </li>
              <li>模型元数据（发布日期、定价、上下文）：models.dev，MIT；缺项时由 LiteLLM、OpenRouter、Vercel AI Gateway 公开目录补齐事实字段。</li>
              <li>编程分项：LiveBench，Apache-2.0。</li>
              {/*
                CC-BY 4.0 要求四件事：署创作者、给许可名与链接、给材料链接、声明改动。
                前三项在这一句里，第四项是后半句——少了它就是违约。
              */}
              <li>
                竞技场成绩（文生图、文生视频、图像与视频编辑、文本、搜索、文档）：
                {outbound(LMARENA_DATASET) ? (
                  <a
                    href={LMARENA_DATASET}
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-dotted hover:text-[var(--color-gold)]"
                  >
                    LMArena 官方榜单数据集
                  </a>
                ) : (
                  'LMArena 官方榜单数据集（lmarena-ai/leaderboard-dataset）'
                )}
                ，
                <a
                  href="https://creativecommons.org/licenses/by/4.0/"
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-dotted hover:text-[var(--color-gold)]"
                >
                  CC-BY 4.0
                </a>
                。本站做过两处改动：把上游的模型名匹配到站内的模型条目，以及按本站的赛制分列重新排序；
                分数本身原样引用，未做换算。这些分数是真人盲投的偏好分，与学术评测不可比，因此单独成榜。
              </li>
              <li>中文像素字体：Fusion Pixel Font（缝合像素字体），OFL-1.1。</li>
            </ul>
          </section>

        </div>
      </div>
    </main>
  );
}
