export function uid(prefix = ''): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}${Date.now().toString(36)}${rand}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} d`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function fileExt(path: string): string {
  const base = path.split('/').pop() || '';
  const idx = base.lastIndexOf('.');
  return idx > 0 ? base.slice(idx + 1).toLowerCase() : '';
}

export function baseName(path: string): string {
  return path.split('/').pop() || path;
}

export function dirName(path: string): string {
  const parts = path.split('/');
  parts.pop();
  return parts.join('/');
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + `\n...[truncado em ${max} caracteres]`;
}

export function joinPath(...parts: string[]): string {
  return parts.filter(Boolean).join('/').replace(/\/+/g, '/');
}

export function safeFileName(name: string): string {
  return name.replace(/[^\w.\- ]/g, '_').trim() || 'sem-nome';
}

export function sanitizeRelPath(p: string): string {
  const cleaned = p.replace(/\\/g, '/');
  const parts: string[] = [];
  for (const seg of cleaned.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') {
      parts.pop();
      continue;
    }
    parts.push(seg);
  }
  return parts.join('/');
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function classNames(...xs: (string | false | null | undefined)[]): string {
  return xs.filter(Boolean).join(' ');
}
