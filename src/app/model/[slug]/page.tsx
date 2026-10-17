import Link from "next/link";
import { notFound } from "next/navigation";
import { loadSnapshot } from "@/lib/snapshot";
import { listSpriteSlugs, spriteOverlaysBaked } from "@/lib/sprites-available";
import { profileFor } from "@/data/vendor-registry";
import { VendorCrest } from "@/components/character/VendorCrest";
import { Character } from "@/components/character/Character";
import {
  Blackboard,
  Bookshelf,
  Calendar,
  Computer,
  Fridge,
  Gate,
} from "@/components/room/Furniture";
import { GroundBackdrop } from "@/components/world/Ground";
import { SiteHeader } from "@/components/world/SiteHeader";
import { DEFAULT_LANG, getDict } from "@/lib/i18n";
import {
  bookshelfOf,
  buildScales,
  isSingleSource,
  rankByEci,
  shelfDustOf,
  visualOf,
} from "@/lib/derive";
import { SWE_LEAGUE } from "@/components/character/ModelRoom";
import { AbilityBars } from "@/components/character/AbilityBars";
import { CodingLedger } from "@/components/character/CodingLedger";
import { ReviewLinks } from "@/components/character/ReviewLinks";
import { LineageStrip } from "@/components/character/LineageStrip";
import { VideoList } from "@/components/character/VideoList";
import { buildLineage } from "@/lib/lineage";
import { loadVideoLibrary } from "@/lib/video-library";
import { videosFor } from "@/lib/videos";
import { ScoreLedger } from "@/components/leaderboard/ScoreLedger";
import { AffiliateStrip } from "@/components/world/AffiliateStrip";
import { buildAptitudeScale } from "@/lib/aptitude";
import { buildPersonaContext, contextAnchor, personaFor } from "@/lib/persona";
import { attributionFor, loadAttribution } from "@/lib/attribution";
import { kindOf } from "@/lib/kind";
import {
  formatBool,
  formatContext,
  formatCount,
  formatDate,
  formatModalities,
  formatParams,
  formatPrice,
  formatScore,
} from "@/lib/format";

export function generateStaticParams() {
  return loadSnapshot().models.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({ params }: PageProps<"/model/[slug]">) {
  const { slug } = await params;
  const model = loadSnapshot().models.find((m) => m.slug === slug);
  if (!model) return { title: "未知居民" };
  const profile = profileFor(model.vendorId);
  return {
    title: model.name,
    description: `${profile.nameZh}的${model.name}：上下文 ${model.contextWindow ?? "未知"} tokens，输出单价 ${model.pricing.outputPerMTok ?? "未知"} 美元每百万 tokens。数据每 12 小时自动同步。`,
  };
}

/** 属性面板的一行。来源标注是这个站区别于「又一个模型排行榜」的地方。 */
function Row({
  label,
  value,
  source,
}: {
  label: string;
  value: string;
  source?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-white/10 py-2 last:border-0">
      <dt className="shrink-0 text-[12px] text-[var(--color-ghost)]">
        {label}
      </dt>
      <dd className="text-right text-xs text-[var(--color-parchment)]">
        {value}
        {source && (
          <span className="ml-2 text-[12px] text-[var(--color-ghost)]">
            {source}
          </span>
        )}
      </dd>
    </div>
  );
}

/** 一件家具加它的说明。家具本身是图，说明才是可被搜索引擎和读屏软件读到的内容。 */
function Piece({
  children,
  label,
  value,
}: {
  children: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <figure className="flex w-32 flex-col items-center gap-2 text-center">
      <div className="flex h-28 items-end justify-center">{children}</div>
      <figcaption>
        <div className="text-[12px] text-[var(--color-parchment)]">{label}</div>
        <div className="text-[12px] leading-tight text-[var(--color-ghost)]">
          {value}
        </div>
      </figcaption>
    </figure>
  );
}

export default async function ModelRoomPage({
  params,
}: PageProps<"/model/[slug]">) {
  const { slug } = await params;
  const lang = DEFAULT_LANG;
  const dict = getDict(lang);
  const snapshot = loadSnapshot();
  const model = snapshot.models.find((m) => m.slug === slug);
  if (!model) notFound();

  const now = new Date(snapshot.generatedAt);
  const attribution = loadAttribution();
  const scales = buildScales(
    snapshot.models,
    (id) =>
      attributionFor(attribution, id, "swe_bench_pro")?.attributionType ===
      "third-party",
  );
  const ranks = rankByEci(snapshot.models);
  const rank = ranks.get(model.id) ?? null;
  const visual = visualOf(model, rank, now, scales);
  const profile = profileFor(model.vendorId);
  const vendor = snapshot.vendors.find((v) => v.id === model.vendorId);

  const shelf = bookshelfOf(model);
  const dust = shelfDustOf(model);
  const computer = scales.computer.computerOf(model);
  const league = computer.league ? SWE_LEAGUE[computer.league] : null;

  const aptitude = buildAptitudeScale(snapshot.models).rowOf(model);
  const persona = personaFor(
    model,
    buildPersonaContext(snapshot.models, snapshot.vendors),
  );
  // 「一次能读完《哈利·波特》全七部」比「1,048,576 tokens」有体感得多
  const anchor = contextAnchor(model.contextWindow);
  const kind = kindOf(model);
  const lineage = buildLineage(model, snapshot.models);
  const videoLibrary = loadVideoLibrary();
  const video = videosFor(videoLibrary, model.id, model.name);

  // 黑板的公式密度取数学与科学两项成绩的均值，两项都没有就是一块空黑板
  const mathScores = [
    model.benchmarks.aime,
    model.benchmarks.gpqa_diamond,
  ].filter((v): v is number => v != null);
  const density =
    mathScores.length > 0
      ? mathScores.reduce((a, b) => a + b, 0) / mathScores.length / 100
      : 0;

  const computerLabel: Record<string, string> = {
    none: "盖着布的桌子",
    crt: "老式显像管",
    laptop: "一台笔记本",
    dual: "双屏工作站",
    battlestation: "多屏黑客洞",
  };

  const computerNote = league
    ? `${computer.score!.toFixed(1)}% · ${league.name}`
    : "没有公开的编程评测成绩";

  return (
    <main className="relative min-h-dvh">
      <GroundBackdrop />

      <SiteHeader current="plaza" lang={lang} />

      <div className="page-shell relative pb-8 pt-2">
        {/* 居民名牌 */}
        <header className="mt-2 flex flex-wrap items-end gap-6">
          <Character
            overlaysNeeded={!spriteOverlaysBaked()}
            visual={visual}
            lang={lang}
            hasSprite={listSpriteSlugs().has(model.slug)}
            showLabel={false}
            linked={false}
          />
          <div className="flex-1">
            <h1 className="pixel-outline text-2xl sm:text-3xl">{model.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
              <Link
                href={`/vendor/${model.vendorId}/`}
                className="flex items-center gap-1.5 text-[var(--color-parchment)] hover:text-[var(--color-gold)]"
              >
                <VendorCrest
                  motif={profile.motif}
                  accentColor={profile.accentColor}
                  size={16}
                />
                {profile.nameZh}的全部模型 →
              </Link>
              {vendor && (
                <span
                  style={{
                    color:
                      vendor.continent === "west"
                        ? "var(--color-west)"
                        : "var(--color-east)",
                  }}
                >
                  {dict.continent[vendor.continent]}
                </span>
              )}
              {/* 类型点进去是总表里同类的全部模型：「视觉」→ 所有能看图的模型 */}
              {kind && (
                <Link
                  href={`/leaderboard/all/?kind=${kind}`}
                  title={dict.kind.hint[kind]}
                  className="border border-[var(--color-ink)] bg-black/35 px-1.5 leading-5 text-[var(--color-parchment)] hover:text-[var(--color-gold)]"
                >
                  {dict.kind.label[kind]}模型
                </Link>
              )}
              <span className="text-[var(--color-gold)]">
                {rank != null
                  ? `综合智力第 ${rank} 名`
                  : dict.unknown.notRanked}
              </span>
              {model.retiredAt && (
                <span className="text-[var(--color-ghost)]">
                  {dict.status.retired}
                </span>
              )}
            </div>
            {/* 一句话定位。放在名字正下方，是整页最先该被读到的一行。 */}
            <p className="mt-3 text-[14px] leading-snug text-[var(--color-parchment)]">
              {persona}
            </p>
            {/* 看完定位，下一个动作往往是「别人怎么评价它」。所以贴着这句话放，不单开一节。 */}
            <ReviewLinks modelName={model.name} slug={model.slug} lang={lang} />
            {isSingleSource(model) && (
              <p className="mt-3 text-[12px] text-[var(--color-ghost)]">
                ⚠ {dict.unknown.singleSource}
              </p>
            )}
          </div>

          {/* 四条能力横条，与广场卡片同源，这里用大号 */}
          <div className="min-w-[240px] flex-1 sm:max-w-sm">
            <AbilityBars row={aptitude} />
            {anchor && (
              <p className="mt-2 text-[12px] text-[var(--color-ghost)]">
                记性换算成体感：{anchor}
              </p>
            )}
          </div>
        </header>

        {/* 同系列历代。紧跟名牌：「这是第几代」和名字、厂商、类型是同一层的身份信息。 */}
        {lineage && (
          <LineageStrip
            lineage={lineage}
            kind={kind}
            vendorId={model.vendorId}
            vendorName={profile.nameZh}
            lang={lang}
          />
        )}

        {/* 营地 */}
        <section className="mt-8">
          <h2 className="mb-3 text-sm text-[var(--color-parchment)]">
            她的营地
          </h2>
          <div className="pixel-panel-dark overflow-x-auto p-6">
            <div
              className="flex min-w-max items-end gap-8 border-b-4 pb-4"
              style={{ borderColor: "var(--color-stone-dark)" }}
            >
              <Piece label="电脑" value={computerNote}>
                <Computer
                  tier={computer.tier}
                  title={`编程能力：${computerLabel[computer.tier]}`}
                  flicker={league?.thirdParty === true}
                  dim={league?.thirdParty === false}
                />
              </Piece>

              <Piece
                label="书架"
                value={
                  shelf
                    ? `${shelf} 层 · 记忆 ${formatContext(model.contextWindow, lang)}`
                    : dict.unknown.noData
                }
              >
                {shelf ? (
                  <Bookshelf tier={shelf} dust={dust} title="上下文窗口" />
                ) : (
                  <div className="text-[12px] text-[var(--color-ghost)]">
                    没有书架
                  </div>
                )}
              </Piece>

              <Piece
                label="黑板"
                value={density > 0 ? `数学与科学推理` : "一块空黑板"}
              >
                <Blackboard density={density} title="数学与科学推理成绩" />
              </Piece>

              <Piece
                label="日历"
                value={
                  model.knowledgeCutoff
                    ? `知识停在 ${model.knowledgeCutoff}`
                    : "知识截止日期未公开"
                }
              >
                <Calendar
                  label={model.knowledgeCutoff ?? ""}
                  title="知识截止日期"
                />
              </Piece>

              {model.capabilities.promptCaching && (
                <Piece label="冰箱" value="支持上下文缓存，能存记忆">
                  <Fridge title="上下文缓存" />
                </Piece>
              )}

              <Piece
                label={model.openWeights ? "敞开的门" : "门禁"}
                value={
                  model.openWeights ? "开源权重，谁都能进" : "闭源，权重不公开"
                }
              >
                <Gate
                  open={model.openWeights === true}
                  title={model.openWeights ? "开源权重" : "闭源"}
                />
              </Piece>
            </div>
          </div>
        </section>

        {/* 属性面板 */}
        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="pixel-panel-dark p-5">
            <h2 className="mb-3 text-sm text-[var(--color-parchment)]">身世</h2>
            <dl>
              <Row
                label={dict.attr.releaseDate}
                value={formatDate(
                  model.releaseDate,
                  model.releaseDatePrecision,
                  lang,
                )}
                source={model.provenance.releaseDate}
              />
              <Row
                label={dict.attr.knowledgeCutoff}
                value={model.knowledgeCutoff ?? dict.unknown.noData}
              />
              <Row label={dict.attr.params} value={formatParams(model, lang)} />
              <Row
                label={dict.attr.openWeights}
                value={formatBool(model.openWeights, lang)}
              />
              <Row
                label={dict.attr.license}
                value={model.license ?? dict.unknown.noData}
              />
              <Row
                label={dict.attr.contextWindow}
                value={formatContext(model.contextWindow, lang)}
              />
              <Row
                label={dict.attr.maxOutput}
                value={formatCount(model.maxOutput) ?? dict.unknown.noData}
              />
              <Row
                label={dict.attr.inputPrice}
                value={formatPrice(model.pricing.inputPerMTok, lang)}
              />
              <Row
                label={dict.attr.outputPrice}
                value={formatPrice(model.pricing.outputPerMTok, lang)}
              />
              <Row
                label={dict.attr.kind}
                value={kind ? dict.kind.label[kind] : dict.kind.unknown}
                source={kind ? dict.kind.hint[kind] : undefined}
              />
              <Row
                label={dict.attr.modalities}
                value={`${formatModalities(model.modalities.input, lang)} → ${formatModalities(model.modalities.output, lang)}`}
              />
              <Row
                label={dict.attr.toolCall}
                value={formatBool(model.capabilities.toolCall, lang)}
              />
              <Row
                label={dict.attr.reasoning}
                value={formatBool(model.capabilities.reasoning, lang)}
              />
              <Row
                label={dict.attr.promptCaching}
                value={formatBool(model.capabilities.promptCaching, lang)}
              />
            </dl>
          </div>

          <div className="pixel-panel-dark p-5">
            <h2 className="mb-3 text-sm text-[var(--color-parchment)]">战绩</h2>
            <dl>
              <Row
                label={dict.track.eci}
                value={formatScore(model.benchmarks.eci, lang)}
              />
              <Row
                label="AIME 数学"
                value={formatScore(model.benchmarks.aime, lang, "%")}
              />
              <Row
                label="GPQA Diamond 科学"
                value={formatScore(model.benchmarks.gpqa_diamond, lang, "%")}
              />
              <Row
                label="ARC-AGI-2 抽象推理"
                value={formatScore(model.benchmarks.arc_agi_2, lang, "%")}
              />
              <Row
                label="Fiction.liveBench 长文本"
                value={formatScore(model.benchmarks.fiction_live, lang, "%")}
              />
            </dl>
            <p className="mt-4 text-[12px] leading-relaxed text-[var(--color-ghost)]">
              综合智力、数学、科学、抽象推理与长文本数据来自 Epoch AI（CC-BY
              4.0）。写「未参赛」的项目表示该模型没有被这项评测收录，
              不代表它做不到——本站不会用估算值填补空缺。
            </p>
          </div>
        </section>

        {/*
          编程成绩单独占一节而不是塞进「战绩」表格里，因为它不是一行一个数字：
          这个维度被切成了二十多个互不兼容的赛制，每一条都要带上测量方与出处
          才能被正确解读。
        */}
        <section className="mt-6">
          <div className="pixel-panel-dark p-5">
            <h2 className="mb-3 text-sm text-[var(--color-parchment)]">
              编程战绩（按赛制分列）
            </h2>
            <CodingLedger scores={model.coding ?? []} />
          </div>
        </section>

        {/* 编程以外的全部评测成绩，按榜单分类列出，带池内名次与出处。没有成绩时整节不渲染。 */}
        <ScoreLedger model={model} models={snapshot.models} />

        {/* B 站搜来的实测视频。没有命中时整节不渲染，名牌上那两个按钮仍通向 B 站搜索。 */}
        <VideoList
          videos={video.videos}
          modelName={video.queryName}
          keyword={videoLibrary.keyword}
          authorMid={videoLibrary.authorMid}
        />

        <AffiliateStrip />
      </div>
    </main>
  );
}
