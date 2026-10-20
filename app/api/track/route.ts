import { NextResponse } from 'next/server';
import { hasSupabase, adminClient } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 访问打点。运营用：区分渠道（utm_source）、落地页、来源站点。
 *
 * 设计上是「能记就记，记不上就算了」：打点绝不阻塞用户，失败直接吞掉。
 * 不采集 IP、不存 cookie，只留粗粒度信息（UA 截断 200 字）。
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const url = new URL(req.url);
    const path = String(body.path ?? '/').slice(0, 200);
    const referrer = String(body.referrer ?? '').slice(0, 300);
    const utm = (body.utm ?? {}) as Record<string, string>;

    if (!hasSupabase()) return NextResponse.json({ ok: false, reason: 'no-db' });

    const sb = adminClient();
    await sb.from('visits').insert({
      path,
      referrer,
      utm_source: (utm.utm_source ?? '').slice(0, 60) || null,
      utm_medium: (utm.utm_medium ?? '').slice(0, 60) || null,
      utm_campaign: (utm.utm_campaign ?? '').slice(0, 60) || null,
      ua: (req.headers.get('user-agent') ?? '').slice(0, 200),
    });

    return NextResponse.json({ ok: true });
  } catch {
    // 打点失败不影响任何主流程
    return NextResponse.json({ ok: false });
  }
}

/** 后台看数：近 N 天按渠道/页面聚合 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  const adminKey = process.env.ADMIN_KEY ?? 'dev';
  if (key !== adminKey) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!hasSupabase()) return NextResponse.json({ error: '未配置数据库' }, { status: 400 });

  const days = Math.min(90, Number(url.searchParams.get('days') ?? 14));
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const sb = adminClient();
  const { data, error } = await sb
    .from('visits')
    .select('at, path, referrer, utm_source')
    .gte('at', since)
    .order('at', { ascending: false })
    .limit(20000);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const rows = data ?? [];
  const byDay = new Map<string, number>();
  const bySource = new Map<string, number>();
  const byPath = new Map<string, number>();

  for (const r of rows) {
    const day = String(r.at).slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
    const src = r.utm_source ?? (r.referrer ? hostOf(r.referrer) : '直接访问');
    bySource.set(src, (bySource.get(src) ?? 0) + 1);
    const p = r.path ?? '/';
    byPath.set(p, (byPath.get(p) ?? 0) + 1);
  }

  return NextResponse.json({
    total: rows.length,
    days,
    byDay: [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)),
    bySource: [...bySource.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15),
    byPath: [...byPath.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15),
  });
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '其他';
  }
}
