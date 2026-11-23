import type { DiffLine } from '@/types';

// Diff de linhas baseado em LCS — usado para mostrar alteracoes propostas pela IA
// antes de aplica-las no projeto.
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.length ? before.split('\n') : [];
  const b = after.length ? after.split('\n') : [];
  const n = a.length;
  const m = b.length;

  // Para arquivos grandes, diff simplificado
  if (n * m > 1_500_000) {
    return [
      ...a.map((text, i) => ({ type: 'del' as const, text, oldLine: i + 1 })),
      ...b.map((text, i) => ({ type: 'add' as const, text, newLine: i + 1 })),
    ];
  }

  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: 'ctx', text: a[i], oldLine: i + 1, newLine: j + 1 });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ type: 'del', text: a[i], oldLine: i + 1 });
      i++;
    } else {
      out.push({ type: 'add', text: b[j], newLine: j + 1 });
      j++;
    }
  }
  while (i < n) out.push({ type: 'del', text: a[i], oldLine: i + 1 }), i++;
  while (j < m) out.push({ type: 'add', text: b[j], newLine: j + 1 }), j++;
  return out;
}

export function diffStats(lines: DiffLine[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const l of lines) {
    if (l.type === 'add') added++;
    else if (l.type === 'del') removed++;
  }
  return { added, removed };
}
