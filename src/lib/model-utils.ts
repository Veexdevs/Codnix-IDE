import type { ORModel } from '@/types';

export function providerLabel(provider: string): string {
  const map: Record<string, string> = {
    openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google', 'meta-llama': 'Meta',
    deepseek: 'DeepSeek', mistralai: 'Mistral AI', qwen: 'Qwen', 'qwen3': 'Qwen',
    'z-ai': 'Z.AI', moonshotai: 'Moonshot', 'x-ai': 'xAI', cohere: 'Cohere',
    microsoft: 'Microsoft', nvidia: 'NVIDIA', sao10k: 'Sao10K', gryphe: 'Gryphe',
    nousresearch: 'Nous', openrouter: 'OpenRouter', tgwu: 'TGW', featherless: 'Featherless',
    chutes: 'Chutes', tinycoder: 'TinyCoder', agentica: 'Agentica', arliai: 'ArliAI',
    rekaai: 'Reka', tngtech: 'TNG', steampunk: 'Steampunk',infermatica: 'Infermatica',
  };
  return map[provider] || provider.charAt(0).toUpperCase() + provider.slice(1);
}

export function providerColor(provider: string): string {
  const p = provider.toLowerCase();
  if (p.includes('openai') || p.includes('gpt')) return '#10a37f';
  if (p.includes('anthropic') || p.includes('claude')) return '#d97757';
  if (p.includes('google') || p.includes('gemini')) return '#4285f4';
  if (p.includes('deepseek')) return '#4d6bfe';
  if (p.includes('meta')) return '#0866ff';
  if (p.includes('mistral')) return '#fa520f';
  if (p.includes('qwen')) return '#7c3aed';
  if (p.includes('moonshot') || p.includes('kimi')) return '#14b8a6';
  if (p.includes('x-ai') || p.includes('grok')) return '#e5e7eb';
  if (p.includes('z-ai') || p.includes('glm')) return '#f59e0b';
  return 'var(--accent)';
}

export function formatContext(n: number): string {
  if (!n) return '—';
  if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return String(n);
}

export function sortModels(models: ORModel[]): ORModel[] {
  return [...models].sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function searchModels(models: ORModel[], q: string): ORModel[] {
  const term = q.trim().toLowerCase();
  if (!term) return sortModels(models);
  return sortModels(models).filter(
    (m) => m.id.toLowerCase().includes(term) || m.name.toLowerCase().includes(term) || m.provider.toLowerCase().includes(term)
  );
}
