// Lista modelos GRATUITOS do OpenRouter dinamicamente.
// Sem chave obrigatoria para listar; cache de 10 minutos; pode ser atualizado (?refresh=1).
import { NextRequest, NextResponse } from 'next/server';
import { OR_BASE, orHeaders, resolveApiKey } from '@/lib/openrouter';
import type { ORModel } from '@/types';

export const dynamic = 'force-dynamic';

interface ORRawModel {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string; request?: string; image?: string };
  architecture?: { input_modalities?: string[]; modality?: string };
}

interface CacheEntry {
  at: number;
  models: ORModel[];
  total: number;
}
let cache: CacheEntry | null = null;
let refreshing: Promise<CacheEntry> | null = null;
const TTL = 10 * 60 * 1000;

function isFree(m: ORRawModel): boolean {
  const p = m.pricing || {};
  const prompt = p.prompt ?? '1';
  const completion = p.completion ?? '1';
  const request = p.request ?? '0';
  return parseFloat(prompt) === 0 && parseFloat(completion) === 0 && parseFloat(request) === 0;
}

function normalize(m: ORRawModel): ORModel {
  const provider = m.id.includes('/') ? m.id.split('/')[0] : 'openrouter';
  return {
    id: m.id,
    name: (m.name || m.id).replace(/^[^:]+:\s*/, ''),
    provider,
    description: (m.description || '').slice(0, 400),
    contextLength: m.context_length || 0,
    imageInput: Boolean(m.architecture?.input_modalities?.includes('image')),
    promptPrice: parseFloat(m.pricing?.prompt || '0'),
    completionPrice: parseFloat(m.pricing?.completion || '0'),
  };
}

const FEATURED_HINTS = [
  'deepseek', 'qwen', 'llama-3.3', 'llama-4', 'gemini', 'gpt-oss', 'glm', 'kimi', 'mistral', 'grok', 'claude',
];
function markFeatured(models: ORModel[]): ORModel[] {
  return models.map((m) => ({
    ...m,
    featured: FEATURED_HINTS.some((h) => m.id.toLowerCase().includes(h)),
  }));
}

async function fetchModels(refresh: boolean): Promise<CacheEntry> {
  if (cache && !refresh && Date.now() - cache.at < TTL) return cache;
  if (refreshing) return refreshing;

  refreshing = (async () => {
    const { key } = await resolveApiKey();
    const res = await fetch(`${OR_BASE}/models`, {
      headers: key ? orHeaders(key) : { 'Content-Type': 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OPENROUTER_MODELS_HTTP_${res.status}: ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as { data?: ORRawModel[] };
    const all = json.data || [];
    const free = markFeatured(all.filter(isFree).map(normalize));
    cache = { at: Date.now(), models: free, total: all.length };
    return cache;
  })();

  try {
    return await refreshing;
  } finally {
    refreshing = null;
  }
}

export async function GET(req: NextRequest) {
  const refresh = req.nextUrl.searchParams.get('refresh') === '1';
  try {
    const { models, total } = await fetchModels(refresh);
    return NextResponse.json({ ok: true, models, freeCount: models.length, totalCount: total, fetchedAt: cache?.at });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (cache) {
      return NextResponse.json({ ok: true, models: cache.models, freeCount: cache.models.length, totalCount: cache.total, fetchedAt: cache.at, stale: true, warning: msg });
    }
    return NextResponse.json({ ok: false, error: 'Falha ao buscar modelos no OpenRouter', detail: msg }, { status: 502 });
  }
}
