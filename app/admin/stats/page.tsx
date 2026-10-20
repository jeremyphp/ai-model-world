'use client';

import { useEffect, useState } from 'react';

interface Stats {
  total: number;
  days: number;
  byDay: [string, number][];
  bySource: [string, number][];
  byPath: [string, number][];
  error?: string;
}

/**
 * 运营看板：谁从哪来、看了什么。
 *
 * 只读，数据来自 /api/track 的聚合接口。地址用 ?key= 传管理密钥，
 * 与订单后台一致（ADMIN_KEY）。
 */
export default function StatsPage() {
  const [key, setKey] = useState('dev');
  const [days, setDays] = useState(14);
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const r = await fetch(`/api/track?key=${encodeURIComponent(key)}&days=${days}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? '读取失败');
      setStats(j);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '读取失败');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const saved = window.localStorage.getItem('wl-admin-key');
    const k = saved ?? 'dev';
    setKey(k);
    // 自动拉一次
    void (async () => {
      const r = await fetch(`/api/track?key=${encodeURIComponent(k)}&days=14`);
      if (r.ok) setStats(await r.json());
    })();
  }, []);

  const maxDay = Math.max(1, ...(stats?.byDay.map(([, v]) => v) ?? [1]));

  return (
    <main className="wrap">
      <h1>访问看板</h1>
      <div className="row">
        <input type="text" value={key} onChange={(e) => setKey(e.target.value)} placeholder="管理密钥" style={{ maxWidth: 200 }} />
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="pill">
          <option value={7}>近 7 天</option>
          <option value={14}>近 14 天</option>
          <option value={30}>近 30 天</option>
        </select>
        <button className="btn" onClick={load} disabled={loading}>
          {loading ? '读取中…' : '刷新'}
        </button>
      </div>
      {err && <div className="err">{err}</div>}

      {stats && (
        <>
          <div className="panel" style={{ marginTop: 16 }}>
            <b>近 {stats.days} 天访问：{stats.total}</b>
            <div className="meta">数据来自 /api/track（浏览器端上报，不含爬虫与关闭 JS 的访问）</div>
          </div>

          <div className="panel" style={{ marginTop: 12 }}>
            <b>每日访问</b>
            <div className="bars">
              {stats.byDay.length === 0 && <div className="meta">还没有数据</div>}
              {stats.byDay.map(([day, n]) => (
                <div key={day} className="bar">
                  <span className="barlabel">{day.slice(5)}</span>
                  <span className="barfill" style={{ width: `${Math.round((n / maxDay) * 100)}%` }} />
                  <span className="barnum">{n}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="row" style={{ marginTop: 12, alignItems: 'flex-start' }}>
            <div className="panel" style={{ flex: 1, minWidth: 280 }}>
              <b>渠道来源</b>
              <ul className="statlist">
                {stats.bySource.length === 0 && <li className="meta">还没有数据</li>}
                {stats.bySource.map(([src, n]) => (
                  <li key={src}>
                    <span>{src}</span>
                    <b>{n}</b>
                  </li>
                ))}
              </ul>
            </div>
            <div className="panel" style={{ flex: 1, minWidth: 280 }}>
              <b>热门页面</b>
              <ul className="statlist">
                {stats.byPath.map(([p, n]) => (
                  <li key={p}>
                    <span>{p}</span>
                    <b>{n}</b>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}

      <div className="hint" style={{ marginTop: 20 }}>
        要区分渠道，就把链接带上 utm_source，例如：
        <code>?utm_source=xianyu</code>、<code>?utm_source=juejin</code>、<code>?utm_source=nodeloc</code>
      </div>
    </main>
  );
}
