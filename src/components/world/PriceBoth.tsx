import { FX_NOTE, formatCnyPrice, formatUsdPrice } from '@/lib/currency';

/**
 * 双币种价格。
 *
 * 两个数字都渲染进 HTML，由 <html data-cur> 决定显示哪个：
 *   - 默认（无 data-cur）= 美元，即使 JS 挂了也能看
 *   - 切换后 = 人民币
 * 这样静态导出、服务端渲染、无 JS 三种情况都不会出现「空价格」。
 */
export function PriceBoth({ usd, suffix }: { usd: number | null; suffix?: string }) {
  if (usd == null) {
    return <span className="text-[var(--color-ghost)]">暂无数据</span>;
  }
  return (
    <span title={FX_NOTE}>
      <span className="price-usd">{formatUsdPrice(usd)}</span>
      <span className="price-cny">{formatCnyPrice(usd)}</span>
      {suffix ? <span className="text-[var(--color-ghost)]">{suffix}</span> : null}
    </span>
  );
}
