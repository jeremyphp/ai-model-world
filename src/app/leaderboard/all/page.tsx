import Link from 'next/link';
import { GroundBackdrop } from '@/components/world/Ground';
import { SiteHeader } from '@/components/world/SiteHeader';
import { AllModelsTable } from '@/components/leaderboard/AllModelsTable';
import { serializeAllTable } from '@/components/leaderboard/serialize';
import { loadSnapshot } from '@/lib/snapshot';
import { DEFAULT_LANG } from '@/lib/i18n';

export const metadata = { title: '全部模型' };

/**
 * 全部模型总表。排行榜回答「谁最强」，这一页回答「有哪些、各是什么样」——
 * 一张可排序、可筛选的表，每一行都能点进角色房间看全部原始数值与出处。
 */
export default function AllModelsPage() {
  const lang = DEFAULT_LANG;
  const snapshot = loadSnapshot();
  const data = serializeAllTable(snapshot);
  const alive = snapshot.models.filter((m) => !m.retiredAt).length;

  return (
    <main className="relative min-h-dvh">
      <GroundBackdrop />
      <div className="relative">
        <SiteHeader current="leaderboard" lang={lang} />

        <div className="page-shell pb-16 pt-4">
          <div className="mb-6 mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="pixel-outline mb-2 text-2xl sm:text-3xl">全部模型</h1>
              <p className="text-[13px] leading-relaxed text-[var(--color-ghost)]">
                共 {snapshot.models.length} 个模型，其中 {alive} 个在役。点列名排序，点模型名进营地。
                「—」表示没有公开数据，不是零。
              </p>
            </div>
            <Link
              href="/leaderboard/"
              className="pixel-button px-3 py-1.5 text-[13px] font-medium text-[var(--color-ink)]"
            >
              ← 回排行榜
            </Link>
          </div>

          <AllModelsTable data={data} />

          <p className="mt-10 text-[13px] leading-relaxed text-[var(--color-ghost)]">
            综合智力来自 Epoch AI（CC-BY 4.0）；编程一列显示的是在同一赛制、同一测量方的模型里的分位档，
            原始分数与赛制见悬停提示与角色营地。本站不使用 Artificial Analysis 与 LMArena
            的数据，前者禁止再分发，后者禁止自动化抓取。
          </p>
        </div>
      </div>
    </main>
  );
}
