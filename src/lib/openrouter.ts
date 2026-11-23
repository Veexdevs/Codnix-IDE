// Integracao server-side com a API do OpenRouter.
// A chave NUNCA vai para o cliente: resolvida a partir das Configuracoes (seguras)
// ou da variavel de ambiente OPENROUTER_API_KEY.
import 'server-only';
import { getSetting } from './storage';

export const OR_BASE = 'https://openrouter.ai/api/v1';

export type KeySource = 'settings' | 'env' | null;

export async function resolveApiKey(): Promise<{ key: string | null; source: KeySource }> {
  try {
    const fromSettings = await getSetting<string>('openrouter_api_key');
    if (fromSettings && typeof fromSettings === 'string' && fromSettings.trim().length > 10) {
      return { key: fromSettings.trim(), source: 'settings' };
    }
  } catch {
    // storage indisponivel — segue para env
  }
  const env = process.env.OPENROUTER_API_KEY;
  if (env && env.trim().length > 10) return { key: env.trim(), source: 'env' };
  return { key: null, source: null };
}

export function orHeaders(key: string): Record<string, string> {
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': process.env.CODNIX_PUBLIC_URL || 'https://codnix-ide.vercel.app',
    'X-Title': 'CODNIX IDE',
  };
}

export interface ORFriendlyError {
  status: number;
  code: string;
  message: string;
}

export function mapOpenRouterError(status: number, bodyText: string): ORFriendlyError {
  let detail = '';
  try {
    const j = JSON.parse(bodyText);
    detail = j?.error?.message || j?.message || '';
  } catch {
    detail = bodyText.slice(0, 200);
  }
  if (status === 401) {
    return { status, code: 'INVALID_KEY', message: `Chave de API do OpenRouter inválida ou revogada. Verifique em Configurações. ${detail}` };
  }
  if (status === 402) {
    return { status, code: 'LIMIT_REACHED', message: `Limite de utilização atingido: ${detail || 'créditos insuficientes na conta OpenRouter'}.` };
  }
  if (status === 429) {
    return { status, code: 'RATE_LIMIT', message: `Limite de requisições atingido (rate limit). Aguarde alguns segundos e tente novamente. ${detail}` };
  }
  if (status === 404) {
    return { status, code: 'MODEL_NOT_FOUND', message: `Modelo não encontrado ou indisponível nesta conta: ${detail}` };
  }
  if (status === 502 || status === 503 || status === 524) {
    return { status, code: 'MODEL_UNAVAILABLE', message: `Modelo temporariamente indisponível (upstream). Tente outro modelo ou aguarde. ${detail}` };
  }
  return { status, code: 'HTTP_ERROR', message: `Erro do OpenRouter (HTTP ${status}): ${detail || bodyText.slice(0, 200)}` };
}
