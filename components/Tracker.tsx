'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * 访问打点（运营用）。
 *
 * 只在浏览器端跑，fire-and-forget；失败不影响任何功能。
 * utm_* 参数从 URL 取，首次带参访问后存进 sessionStorage，
 * 这样用户站内跳转时渠道不会丢（否则只有落地页能归因）。
 */
export function Tracker() {
  const pathname = usePathname();

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const params = ['utm_source', 'utm_medium', 'utm_campaign'];
      const stored = JSON.parse(window.sessionStorage.getItem('wl-utm') ?? '{}') as Record<string, string>;

      const utm: Record<string, string> = {};
      let hasNew = false;
      for (const k of params) {
        const v = url.searchParams.get(k);
        if (v) {
          utm[k] = v;
          hasNew = true;
        } else if (stored[k]) {
          utm[k] = stored[k];
        }
      }
      if (hasNew) window.sessionStorage.setItem('wl-utm', JSON.stringify(utm));

      const payload = {
        path: pathname || '/',
        referrer: document.referrer || '',
        utm,
      };

      // sendBeacon 优先：页面关闭也不会丢
      const body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
      } else {
        void fetch('/api/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        });
      }
    } catch {
      /* 打点失败无所谓 */
    }
  }, [pathname]);

  return null;
}
