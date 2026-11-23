// Informacoes da chave OpenRouter (uso, limite, free tier) — nunca retorna a chave.
import { NextResponse } from 'next/server';
import { OR_BASE, orHeaders, resolveApiKey } from '@/lib/openrouter';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { key, source } = await resolveApiKey();
  if (!key) {
    return NextResponse.json({ ok: false, code: 'NO_API_KEY', error: 'Nenhuma chave configurada.' }, { status: 401 });
  }
  try {
    let res = await fetch(`${OR_BASE}/key`, { headers: orHeaders(key), cache: 'no-store' });
    if (!res.ok) {
      res = await fetch(`${OR_BASE}/auth/key`, { headers: orHeaders(key), cache: 'no-store' });
    }
    const text = await res.text();
    if (!res.ok) {
      let code = 'HTTP_ERROR';
      if (res.status === 401) code = 'INVALID_KEY';
      else if (res.status === 429) code = 'RATE_LIMIT';
      return NextResponse.json({ ok: false, code, error: text.slice(0, 300) }, { status: res.status });
    }
    const json = JSON.parse(text) as { data?: Record<string, unknown> };
    const d = json.data || {};
    return NextResponse.json({
      ok: true,
      source,
      masked: `${key.slice(0, 12)}...${key.slice(-4)}`,
      info: {
        label: d.label || '',
        usage: d.usage ?? null,
        limit: d.limit ?? null,
        isFreeTier: Boolean(d.is_free_tier),
        rateLimit: d.rate_limit || null,
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, code: 'CONNECTION_ERROR', error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
