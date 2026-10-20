/**
 * 美元 / 人民币双币种展示。
 *
 * 为什么要做：nodeloc 上第一位读者反馈「价格要是能选美元/人民币就好了」，
 * 站内价格数据源统一是美元/百万 tokens，但国内读者看美元没有体感。
 *
 * 三个设计约束：
 *   1. 站点是纯静态导出——不能在渲染时读浏览器语言，否则静态页与客户端不一致；
 *      所以两个币种都渲染出来，用 CSS 切换显示，无 JS 也能用（默认美元）。
 *   2. 汇率必须写死并标注「参考汇率」——实时汇率需要外部 API，
 *      而本站的承诺是「零运行时依赖」。写死一个位置，改一处全站生效。
 *   3. 人民币不显示三位小数：¥0.0195 这种精度对读者没有意义，四舍五入到分。
 */

/** 参考汇率：美元 → 人民币。改这一个数即可全站生效。 */
export const USD_CNY = 7.1;

/** 参考汇率说明，展示在切换按钮的 title 上 */
export const FX_NOTE = `参考汇率 1 美元 ≈ ${USD_CNY} 人民币`;

/** 美元单价（每百万 tokens 等），保留有效位 */
export function formatUsdPrice(usd: number): string {
  if (usd === 0) return '$0';
  const digits = usd < 0.1 ? 3 : usd < 10 ? 2 : 0;
  return `$${usd.toFixed(digits)}`;
}

/** 人民币单价：小于 1 元保留两位，其余保留一位或整数 */
export function formatCnyPrice(usd: number): string {
  if (usd === 0) return '¥0';
  const cny = usd * USD_CNY;
  if (cny < 1) return `¥${cny.toFixed(2)}`;
  if (cny < 100) return `¥${cny.toFixed(1)}`;
  return `¥${Math.round(cny)}`;
}
