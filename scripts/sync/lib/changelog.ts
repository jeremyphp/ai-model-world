/**
 * 变更日志：比较两份快照，把「有什么变了」落成结构化条目。
 *
 * 纯函数部分（diffSnapshots / buildEntry）进 selftest；
 * CLI 在 scripts/sync/changelog.ts，由 sync 工作流在提交快照前调用。
 * 数据文件是 data/changelog.json，站点 /changelog/ 与 RSS 读同一份，
 * 速报 issue 也读同一份——三处永远一致，不会各说各话。
 *
 * 覆盖四类变化，全部用与首页同一套纯函数判定（不是另写一套）：
 *   - 新模型 / 退役模型（id 差集；退役以 retiredAt 为准）
 *   - 新厂商
 *   - 门面换代（buildPlazaRoster 各家的当家门面换了人）
 *   - 冠军易主（buildChampions 八个头衔换了人）
 */

import { canonicalVendorId, VENDOR_REGISTRY } from '../../../src/data/vendor-registry.ts';
import { buildChampions } from '../../../src/lib/champions.ts';
import { buildPlazaRoster, type RosterEntry } from '../../../src/lib/roster.ts';
import { getDict } from '../../../src/lib/i18n.ts';
import type { ChangeEntry, WorldSnapshot } from '../../../src/lib/types.ts';

/** 摘要里每类最多列出的条数，其余折叠成「另有 N 条」 */
const CAP = 12;

const vendorZh = (s: WorldSnapshot, id: string) => s.vendors.find((v) => v.id === id)?.nameZh ?? id;

function flagshipsOf(snapshot: WorldSnapshot, now: Date): Map<string, RosterEntry> {
  const map = new Map<string, RosterEntry>();
  const registryHas = (id: string) => canonicalVendorId(id) in VENDOR_REGISTRY;
  for (const roster of buildPlazaRoster(snapshot.models, snapshot.vendors, now, registryHas)) {
    for (const e of [...roster.entries, ...roster.others]) map.set(e.vendor.id, e);
  }
  return map;
}

/** 纯函数：比较两份快照。没有值得一提的变化时返回 null。 */
export function diffSnapshots(
  oldS: WorldSnapshot,
  newS: WorldSnapshot,
): Omit<ChangeEntry, 'date' | 'summary'> | null {
  const now = new Date(newS.generatedAt);
  const dict = getDict('zh');

  const oldIds = new Set(oldS.models.map((m) => m.id));

  const newModels = newS.models
    .filter((m) => !oldIds.has(m.id) && !m.retiredAt)
    .map((m) => ({ id: m.id, name: m.name, slug: m.slug ?? m.id, vendorZh: vendorZh(newS, m.vendorId) }));
  const retired = newS.models
    .filter((m) => oldIds.has(m.id) && m.retiredAt && !oldS.models.find((o) => o.id === m.id)?.retiredAt)
    .map((m) => ({ id: m.id, name: m.name, slug: m.slug ?? m.id, vendorZh: vendorZh(newS, m.vendorId) }));

  const oldVendors = new Set(oldS.vendors.map((v) => v.id));
  const newVendors = newS.vendors.filter((v) => !oldVendors.has(v.id)).map((v) => ({ id: v.id, nameZh: v.nameZh }));

  const oldFlagships = flagshipsOf(oldS, now);
  const newFlagships = flagshipsOf(newS, now);
  const flagships: ChangeEntry['flagships'] = [];
  for (const [vendorId, entry] of newFlagships) {
    const before = oldFlagships.get(vendorId);
    if (!before || before.model.id === entry.model.id) continue;
    flagships.push({
      vendorId,
      vendorZh: entry.vendor.nameZh,
      before: before.model.name,
      after: entry.model.name,
      slug: entry.model.slug ?? entry.model.id,
    });
  }
  flagships.sort((a, b) => a.vendorZh.localeCompare(b.vendorZh, 'zh'));

  const oldChampions = new Map(
    buildChampions(oldS.models, oldS.vendors, now, (id) => canonicalVendorId(id) in VENDOR_REGISTRY).map((c) => [
      c.key,
      c.model,
    ]),
  );
  const newChampions = buildChampions(newS.models, newS.vendors, now, (id) => canonicalVendorId(id) in VENDOR_REGISTRY);
  const champions: ChangeEntry['champions'] = [];
  for (const c of newChampions) {
    const before = oldChampions.get(c.key);
    if (before && before.id === c.model.id) continue;
    champions.push({
      key: c.key,
      label: dict.champions[c.key],
      before: before?.name ?? '（空缺）',
      after: c.model.name,
      slug: c.model.slug ?? c.model.id,
    });
  }

  const touched = [newModels, retired, newVendors, flagships, champions];
  if (touched.every((t) => t.length === 0)) return null;
  return { newModels, retired, newVendors, flagships, champions };
}

function cap<T>(list: T[]): T[] {
  return list.length <= CAP ? list : list.slice(0, CAP);
}

function list(lines: string[], title: string, items: { name: string; vendorZh: string }[]): void {
  if (items.length === 0) return;
  lines.push(`**${title}（${items.length}）**`);
  for (const it of cap(items)) lines.push(`- ${it.name} · ${it.vendorZh}`);
  if (items.length > CAP) lines.push(`- …另有 ${items.length - CAP} 条`);
}

function buildSummary(d: Omit<ChangeEntry, 'date' | 'summary'>): string {
  const lines: string[] = [];
  list(lines, '新模型', d.newModels);
  list(lines, '退役', d.retired);
  if (d.newVendors.length) {
    lines.push(`**新厂商（${d.newVendors.length}）**`);
    for (const v of d.newVendors) lines.push(`- ${v.nameZh}`);
  }
  if (d.flagships.length) {
    lines.push(`**门面换代（${d.flagships.length}）**`);
    for (const f of d.flagships) lines.push(`- ${f.vendorZh}：${f.before} → ${f.after}`);
  }
  if (d.champions.length) {
    lines.push(`**冠军易主（${d.champions.length}）**`);
    for (const c of d.champions) lines.push(`- ${c.label}：${c.before} → ${c.after}`);
  }
  return lines.join('\n');
}

export function buildEntry(oldS: WorldSnapshot, newS: WorldSnapshot): ChangeEntry | null {
  const d = diffSnapshots(oldS, newS);
  if (!d) return null;
  return { ...d, date: newS.generatedAt, summary: buildSummary(d) };
}
