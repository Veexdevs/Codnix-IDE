// Cliente REST leve para o Supabase (PostgREST) — sem dependencia externa.
// Usado APENAS no servidor para persistir projetos, conversas e configuracoes.
import 'server-only';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_API_KEY || '';

export function supabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

interface RestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  prefer?: string;
  query?: Record<string, string>;
}

export async function supaRest<T = unknown>(table: string, opts: RestOptions = {}): Promise<T> {
  if (!supabaseConfigured()) throw new Error('SUPABASE_NOT_CONFIGURED');
  const url = new URL(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${table}`);
  for (const [k, v] of Object.entries(opts.query || {})) url.searchParams.set(k, v);

  const headers: Record<string, string> = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  };
  if (opts.prefer) headers.Prefer = opts.prefer;

  const res = await fetch(url.toString(), {
    method: opts.method || 'GET',
    headers,
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`SUPABASE_ERROR ${res.status}: ${text.slice(0, 300)}`);
  }
  return (text ? JSON.parse(text) : null) as T;
}
