// Configuracoes seguras server-side (ex.: chave da API do OpenRouter).
// A chave nunca e retornada ao cliente — apenas mascara e origem.
import { NextRequest, NextResponse } from 'next/server';
import { getSetting, setSetting, deleteSetting, storageMode } from '@/lib/storage';
import { resolveApiKey } from '@/lib/openrouter';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { source } = await resolveApiKey();
  let masked: string | null = null;
  if (source === 'settings') {
    const k = await getSetting<string>('openrouter_api_key');
    if (k) masked = `${k.slice(0, 12)}...${k.slice(-4)}`;
  } else if (source === 'env') {
    const k = process.env.OPENROUTER_API_KEY || '';
    masked = `${k.slice(0, 12)}...${k.slice(-4)}`;
  }
  return NextResponse.json({
    ok: true,
    hasKey: source !== null,
    source,
    masked,
    storage: storageMode(),
  });
}

export async function POST(req: NextRequest) {
  let body: { action?: string; apiKey?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Corpo inválido' }, { status: 400 });
  }

  if (body.action === 'clear') {
    await deleteSetting('openrouter_api_key');
    return NextResponse.json({ ok: true, cleared: true });
  }

  const key = (body.apiKey || '').trim();
  if (!key) return NextResponse.json({ ok: false, error: 'Informe a chave.' }, { status: 400 });
  if (!key.startsWith('sk-or-') && !key.startsWith('sb_')) {
    return NextResponse.json({ ok: false, error: 'Chave inválida: chaves do OpenRouter começam com sk-or-.' }, { status: 400 });
  }
  await setSetting('openrouter_api_key', key);
  return NextResponse.json({ ok: true, masked: `${key.slice(0, 12)}...${key.slice(-4)}`, source: 'settings' });
}
