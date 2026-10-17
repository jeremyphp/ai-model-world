import Link from 'next/link';
import { GroundBackdrop } from '@/components/world/Ground';
import { SiteHeader } from '@/components/world/SiteHeader';
import { LeaderboardExplorer } from '@/components/leaderboard/LeaderboardExplorer';
import { serializeExplorer } from '@/components/leaderboard/serialize';
import { AffiliateStrip } from '@/components/world/AffiliateStrip';
import { loadSnapshot } from '@/lib/snapshot';
import { buildTrackIndex } from '@/lib/scores';
import { DEFAULT_LANG } from '@/lib/i18n';

export const metadata = { title: '排行榜' };

/**
 * 排行榜。
 *
 * 快照里每个够 5 个模型的榜单都是一条赛道，外加性价比、上下文、价格、新鲜度四条派生赛道。
 * 赛道在构建期由 `buildTrackIndex` 算好、排好、格式化好，客户端只负责切换与筛选。
 *
 * 没上榜的模型就是「未参赛」，不给假分数：一个模型没被某项评测收录，
 * 不代表它做不到，用估算值填空会让整张榜失去意义。
 */
export default function LeaderboardPage() {
  const lang = DEFAULT_LANG;
  const snapshot = loadSnapshot();
  const tracks = buildTrackIndex(snapshot);
  const data = serializeExplorer(snapshot, tracks);
  const benchmarkTracks = tracks.filter((t) => t.category !== '实用指标' && !t.superseded).length;

  return (
    <main className="relative min-h-dvh">
      <GroundBackdrop />
      <div className="relative">
        <SiteHeader current="leaderboard" lang={lang} />

        <div className="page-shell pb-16 pt-4">
          <div className="mb-6 mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="pixel-outline mb-2 text-2xl sm:text-3xl">排行榜</h1>
              <p className="text-[13px] leading-relaxed text-[var(--color-ghost)]">
                分数全部来自第三方公开评测，按榜单分开比较，跨榜不混算。
                当前 {benchmarkTracks} 个榜单可开榜，覆盖 {snapshot.models.length} 个模型。
              </p>
            </div>
            <Link
              href="/leaderboard/all/"
              className="pixel-button px-3 py-1.5 text-[13px] font-medium text-[var(--color-ink)]"
            >
              查全部 {snapshot.models.length} 个模型 →
            </Link>
          </div>

          <LeaderboardExplorer data={data} />

          <p className="mt-10 text-[13px] leading-relaxed text-[var(--color-ghost)]">
            分数来自 Epoch AI（CC-BY 4.0）、LiveBench（Apache-2.0）与 LMArena 官方数据集（CC-BY 4.0），
            每 12 小时同步一次。本站不使用 Artificial Analysis 的数据，它禁止再分发。
          </p>

          <AffiliateStrip />
        </div>
      </div>
    </main>
  );
}
