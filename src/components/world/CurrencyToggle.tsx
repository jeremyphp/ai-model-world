'use client';

import { useEffect, useState } from 'react';
import { FX_NOTE } from '@/lib/currency';

const KEY = 'aimodle-currency';

/**
 * 币种切换（美元 / 人民币）。
 *
 * 实现上不存 React 状态到价格本身：价格的两种写法已经在 HTML 里，
 * 这里只改 <html data-cur> 让 CSS 决定显示哪个——避免整棵树重渲染。
 * 选择存 localStorage，下次进站沿用；JS 未执行时是美元默认值。
 */
export function CurrencyToggle() {
  const [cur, setCur] = useState<'usd' | 'cny'>('usd');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(KEY);
    const next = saved === 'cny' ? 'cny' : 'usd';
    setCur(next);
    document.documentElement.dataset.cur = next;
    setMounted(true);
  }, []);

  function toggle() {
    const next = cur === 'usd' ? 'cny' : 'usd';
    setCur(next);
    document.documentElement.dataset.cur = next;
    window.localStorage.setItem(KEY, next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={FX_NOTE}
      aria-label={`切换币种，当前显示${cur === 'usd' ? '美元' : '人民币'}`}
      className="pixel-button px-2.5 py-1 text-[12px] font-medium text-[var(--color-ink)]"
    >
      {mounted ? (cur === 'usd' ? '￥转人民币' : '$转美元') : '币种'}
    </button>
  );
}
