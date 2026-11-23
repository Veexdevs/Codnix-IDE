import { describe, it, expect } from 'vitest';
import { extractActions } from '@/lib/dev-tools';
import { sanitizeRelPath } from '@/lib/utils';

describe('extractActions (Modo Desenvolvedor)', () => {
  it('extrai acao de criar arquivo', () => {
    const text = 'Explicação\n```codnix\n{"actions":[{"type":"create_file","path":"src/app.js","content":"console.log(1)"}]}\n```';
    const { actions, cleanText } = extractActions(text);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual({ type: 'create_file', path: 'src/app.js', content: 'console.log(1)' });
    expect(cleanText).not.toContain('create_file');
  });

  it('extrai multiplas acoes e comandos', () => {
    const text = '```codnix\n[{"type":"edit_file","path":"a.js","find":"x","replace":"y"},{"type":"run_command","command":"npm test"},{"type":"delete_file","path":"b.tmp"}]\n```';
    const { actions } = extractActions(text);
    expect(actions.map((a) => a.type)).toEqual(['edit_file', 'run_command', 'delete_file']);
  });

  it('bloco json invalido nao quebra', () => {
    const { actions } = extractActions('```codnix\n{{{invalido\n```');
    expect(actions).toHaveLength(0);
  });
});

describe('sanitizeRelPath', () => {
  it('remove traversal e absolutos', () => {
    expect(sanitizeRelPath('../../etc/passwd')).toBe('etc/passwd');
    expect(sanitizeRelPath('/abs/path')).toBe('abs/path');
    expect(sanitizeRelPath('a//b/../c')).toBe('a/c');
    expect(sanitizeRelPath('')).toBe('');
  });
});
