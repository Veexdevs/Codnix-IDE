import { describe, it, expect } from 'vitest';
import { diffLines, diffStats } from '@/lib/diff';

describe('diffLines', () => {
  it('detecta adicoes', () => {
    const d = diffLines('a\nb', 'a\nb\nc');
    expect(d.filter((l) => l.type === 'add').length).toBe(1);
    expect(diffStats(d)).toEqual({ added: 1, removed: 0 });
  });

  it('detecta remocoes', () => {
    const d = diffLines('a\nb\nc', 'a\nc');
    expect(d.filter((l) => l.type === 'del').length).toBe(1);
    expect(diffStats(d).removed).toBe(1);
  });

  it('arquivos iguais produzem so contexto', () => {
    const d = diffLines('x\ny', 'x\ny');
    expect(d.every((l) => l.type === 'ctx')).toBe(true);
  });
});
