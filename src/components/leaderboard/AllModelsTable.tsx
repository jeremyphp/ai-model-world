'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { VendorCrest } from '@/components/character/VendorCrest';
import { DEFAULT_LANG, getDict } from '@/lib/i18n';
import { KINDS } from '@/lib/kind';
import { filterFromParams, filterToParams, makePredicate, EMPTY_FILTER, type FilterState } from './filters';
import { ModelFilters } from './ModelFilters';
import type { AllRow, AllTableData } from './types';
import { useUrlQuery } from './useUrlQuery';

/**
 * 全部模型总表：查询能力的主入口。
 *
 * 一行一个模型，可按任意列排序。没有数据的格子写「—」并排到末尾，绝不填 0。
 * 编程那一列只显示分位档（顶尖/很强/中等……），原始分数放在悬停提示里——
 * 二十多个赛制的分数互不可比，并排摆出来一定会被读者直接比大小。
 */

type SortKey = 'name' | 'vendor' | 'region' | 'kind' | 'date' | 'open' | 'ctx' | 'price' | 'eci' | 'code' | 'n';
type Dir = 'asc' | 'desc';

const dict = getDict(DEFAULT_LANG);
/** 类型列按 KINDS 的顺序排（文本 → 视觉 → … → 语音），不按中文字符排 */
const KIND_ORDER = new Map(KINDS.map((k, i) => [k, i]));

const DEFAULT_LIMIT = 100;
const DEFAULT_SORT: { key: SortKey; dir: Dir } = { key: 'eci', dir: 'desc' };

interface Column {
  key: SortKey;
  label: string;
  /** 该列默认的排序方向：数值列先看最大，名字列先看 A */
  defaultDir: Dir;
  /** 移动端隐藏的次要列 */
  secondary?: boolean;
  align?: 'left' | 'right';
}

const COLUMNS: Column[] = [
  { key: 'name', label: '模型', defaultDir: 'asc' },
  { key: 'vendor', label: '厂商', defaultDir: 'asc', secondary: true },
  { key: 'region', label: '地区', defaultDir: 'asc', secondary: true },
  { key: 'kind', label: dict.kind.filterLabel, defaultDir: 'asc', secondary: true },
  { key: 'date', label: '发布', defaultDir: 'desc', secondary: true },
  { key: 'open', label: '开源', defaultDir: 'desc', secondary: true },
  { key: 'ctx', label: '上下文', defaultDir: 'desc', secondary: true, align: 'right' },
  { key: 'price', label: '输出价格', defaultDir: 'asc', align: 'right' },
  { key: 'eci', label: '综合智力', defaultDir: 'desc', align: 'right' },
  { key: 'code', label: '编程', defaultDir: 'desc', align: 'right' },
  { key: 'n', label: '参赛榜数', defaultDir: 'desc', secondary: true, align: 'right' },
];

export function AllModelsTable({ data }: { data: AllTableData }) {
  const [params, update] = useUrlQuery();
  const filter = useMemo(() => (params ? filterFromParams(params) : EMPTY_FILTER), [params]);
  const showAll = params?.get('all') === '1';

  const sortKey = (COLUMNS.find((c) => c.key === params?.get('sort'))?.key ?? DEFAULT_SORT.key) as SortKey;
  const dir: Dir = params?.get('dir') === 'asc' ? 'asc' : params?.get('dir') === 'desc' ? 'desc' : DEFAULT_SORT.dir;

  const vendorMap = useMemo(() => new Map(data.vendors.map((v) => [v.id, v])), [data.vendors]);
  const predicate = useMemo(() => makePredicate(filter, vendorMap), [filter, vendorMap]);

  const rows = useMemo(() => {
    const kept = data.rows.filter((r) => predicate(data.models[r.m]));
    const sign = dir === 'asc' ? 1 : -1;
    // 缺数据的一律排最后，与方向无关：谁都不想翻到底才看见有数据的
    const num = (a: number | null, b: number | null) => {
      if (a == null && b == null) return 0;
      if (a == null) return 1;
      if (b == null) return -1;
      return (a - b) * sign;
    };
    const str = (a: string, b: string) => a.localeCompare(b, 'zh-Hans-CN') * sign;
    const byName = (a: AllRow, b: AllRow) =>
      data.models[a.m].name.localeCompare(data.models[b.m].name, 'zh-Hans-CN');

    const cmp = (a: AllRow, b: AllRow): number => {
      const ma = data.models[a.m];
      const mb = data.models[b.m];
      switch (sortKey) {
        case 'name':
          return str(ma.name, mb.name);
        case 'vendor':
          return str(vendorMap.get(ma.vendor)?.nameZh ?? ma.vendor, vendorMap.get(mb.vendor)?.nameZh ?? mb.vendor);
        case 'region':
          return str(vendorMap.get(ma.vendor)?.continent ?? 'west', vendorMap.get(mb.vendor)?.continent ?? 'west');
        case 'kind':
          return num(
            ma.kind ? (KIND_ORDER.get(ma.kind) ?? null) : null,
            mb.kind ? (KIND_ORDER.get(mb.kind) ?? null) : null,
          );
        case 'date':
          return num(a.date ? Date.parse(a.date) : null, b.date ? Date.parse(b.date) : null);
        case 'open':
          return num(ma.open == null ? null : ma.open ? 1 : 0, mb.open == null ? null : mb.open ? 1 : 0);
        case 'ctx':
          return num(a.ctx, b.ctx);
        case 'price':
          return num(a.price, b.price);
        case 'eci':
          return num(a.eci, b.eci);
        case 'code':
          return num(a.code?.fill ?? null, b.code?.fill ?? null);
        case 'n':
          return num(a.n, b.n);
      }
    };
    return kept.sort((a, b) => cmp(a, b) || byName(a, b));
  }, [data, predicate, sortKey, dir, vendorMap]);

  const shown = showAll ? rows : rows.slice(0, DEFAULT_LIMIT);

  const setFilter = (next: FilterState) => update({ ...filterToParams(next), all: null });
  const setSort = (col: Column) => {
    const nextDir: Dir = sortKey === col.key ? (dir === 'asc' ? 'desc' : 'asc') : col.defaultDir;
    const isDefault = col.key === DEFAULT_SORT.key && nextDir === DEFAULT_SORT.dir;
    update({ sort: isDefault ? null : col.key, dir: isDefault ? null : nextDir });
  };

  return (
    <div>
      <ModelFilters value={filter} onChange={setFilter} vendors={data.vendors} models={data.models} matched={rows.length} />

      <div className="pixel-panel-dark mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr className="border-b-2 border-[var(--color-ink)] text-[13px] text-[var(--color-ghost)]">
              {COLUMNS.map((c) => {
                const on = c.key === sortKey;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={on ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={`whitespace-nowrap px-1.5 py-2 font-normal first:pl-2 sm:px-2 sm:first:pl-3 sm:last:pr-3 ${
                      c.secondary ? 'hidden md:table-cell' : ''
                    } ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                  >
                    <button
                      type="button"
                      onClick={() => setSort(c)}
                      className="inline-flex items-center gap-1 hover:text-[var(--color-gold)]"
                      style={{ color: on ? 'var(--color-gold)' : undefined }}
                    >
                      {c.label}
                      <span aria-hidden className="font-pixel text-[11px]">
                        {on ? (dir === 'asc' ? '▲' : '▼') : '·'}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {shown.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3 py-6 text-center text-[14px] text-[var(--color-ghost)]">
                  没有符合条件的模型。
                </td>
              </tr>
            )}
            {shown.map((r) => {
              const m = data.models[r.m];
              const v = vendorMap.get(m.vendor);
              return (
                <tr key={m.id} className="hover:bg-white/5">
                  <td className="max-w-[8rem] px-1.5 py-1.5 pl-2 sm:max-w-[14rem] sm:px-2 sm:pl-3">
                    <Link
                      href={`/model/${m.slug}/`}
                      className="flex items-center gap-1.5 text-[var(--color-parchment)] hover:text-[var(--color-gold)]"
                    >
                      <VendorCrest motif={v?.motif ?? 'wanderer'} accentColor={v?.accent ?? '#8a8a8a'} size={12} />
                      <span className="truncate">{m.name}</span>
                      {m.retired && <span className="shrink-0 text-[13px] text-[var(--color-ghost)]">已退役</span>}
                    </Link>
                  </td>
                  <td className="hidden whitespace-nowrap px-2 py-1.5 text-[var(--color-parchment-dim)] md:table-cell">
                    {v?.nameZh ?? m.vendor}
                  </td>
                  <td className="hidden whitespace-nowrap px-2 py-1.5 md:table-cell">
                    <span
                      style={{
                        color: v?.continent === 'east' ? 'var(--color-east)' : 'var(--color-west)',
                      }}
                    >
                      {v?.continent === 'east' ? '国内' : '国外'}
                    </span>
                  </td>
                  <td className="hidden whitespace-nowrap px-2 py-1.5 md:table-cell">
                    {m.kind ? (
                      <span title={dict.kind.hint[m.kind]} className="cursor-help text-[var(--color-parchment-dim)]">
                        {dict.kind.label[m.kind]}
                      </span>
                    ) : (
                      <Cell v={null} />
                    )}
                  </td>
                  <td className="hidden whitespace-nowrap px-2 py-1.5 text-[var(--color-parchment-dim)] md:table-cell">
                    {r.dateText}
                  </td>
                  <td className="hidden whitespace-nowrap px-2 py-1.5 md:table-cell">
                    <Cell v={m.open == null ? null : m.open ? '开源' : '闭源'} />
                  </td>
                  <td className="hidden whitespace-nowrap px-2 py-1.5 text-right tabular-nums md:table-cell">
                    <Cell v={r.ctxText} />
                  </td>
                  <td className="whitespace-nowrap px-1.5 py-1.5 text-right tabular-nums sm:px-2">
                    <Cell v={r.priceText} />
                  </td>
                  <td className="whitespace-nowrap px-1.5 py-1.5 text-right tabular-nums sm:px-2">
                    {r.eci != null ? (
                      <span title={`Epoch Capabilities Index ${r.eci.toFixed(1)}，峡谷第 ${r.eciRank} 名`}>
                        <span className="text-[var(--color-parchment)]">{r.eci.toFixed(1)}</span>
                        <span className="font-pixel ml-1.5 hidden text-[12px] text-[var(--color-gold)] sm:inline">
                          #{r.eciRank}
                        </span>
                      </span>
                    ) : (
                      <Cell v={null} />
                    )}
                  </td>
                  <td className="whitespace-nowrap px-1.5 py-1.5 pr-2 text-right sm:px-2">
                    {r.code ? (
                      <span title={r.code.title} className="cursor-help text-[var(--color-parchment)]">
                        {r.code.verdict}
                        {r.code.self && <span className="ml-1 text-[13px] text-[var(--color-ghost)]">自报</span>}
                      </span>
                    ) : (
                      <Cell v={null} />
                    )}
                  </td>
                  <td className="hidden whitespace-nowrap px-2 py-1.5 pr-3 text-right tabular-nums text-[var(--color-parchment-dim)] md:table-cell">
                    {r.n > 0 ? r.n : <Cell v={null} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length > DEFAULT_LIMIT && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => update({ all: showAll ? null : '1' })}
            className="pixel-button px-4 py-1.5 text-[13px] text-[var(--color-ink)]"
          >
            {showAll ? `只看前 ${DEFAULT_LIMIT} 个` : `展开全部 ${rows.length} 个`}
          </button>
        </div>
      )}
    </div>
  );
}

/** 空值统一写成一根短横，颜色压暗——它是「没有数据」，不是一个值 */
function Cell({ v }: { v: string | null }) {
  if (v == null) {
    return (
      <span className="text-white/25" title="暂无数据">
        —
      </span>
    );
  }
  return <span className="text-[var(--color-parchment)]">{v}</span>;
}
