// Cliente HTTP do CODNIX (browser). Em apps nativos aponta para o backend publicado.
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');

export function apiUrl(path: string): string {
  if (path.startsWith('http')) return path;
  return `${API_BASE}${path}`;
}

export async function apiJson<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const json = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
  if (!res.ok || json?.ok === false) {
    const err = new Error(json?.error || `HTTP ${res.status}`) as Error & { code?: string; status?: number; payload?: unknown };
    err.code = json?.code;
    err.status = res.status;
    err.payload = json;
    throw err;
  }
  return json as T;
}
