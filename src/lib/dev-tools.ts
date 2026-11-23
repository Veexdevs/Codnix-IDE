import type { FileAction } from '@/types';
import { sanitizeRelPath } from './utils';

// O Modo Desenvolvedor instrui o modelo a emitir blocos ```codnix com JSON
// descrevendo acoes reais de arquivo. Esta funcao extrai e valida essas acoes.
const CODE_FENCE_RE = /```(?:codnix|codnix-actions)\s*\n([\s\S]*?)```/g;

export function extractActions(text: string): { actions: FileAction[]; cleanText: string } {
  const actions: FileAction[] = [];
  const blocks: string[] = [];
  let m: RegExpExecArray | null;
  CODE_FENCE_RE.lastIndex = 0;
  while ((m = CODE_FENCE_RE.exec(text)) !== null) {
    blocks.push(m[0]);
    try {
      const parsed = JSON.parse(m[1].trim());
      const list: unknown[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.actions) ? parsed.actions : [parsed];
      for (const raw of list) {
        const action = normalizeAction(raw);
        if (action) actions.push(action);
      }
    } catch {
      // bloco invalido: ignora, mas mantem o texto para o usuario ver
    }
  }
  let cleanText = text;
  for (const b of blocks) cleanText = cleanText.replace(b, '');
  return { actions, cleanText: cleanText.trim() };
}

function normalizeAction(raw: unknown): FileAction | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const type = String(r.type || r.action || '');
  switch (type) {
    case 'create_file':
    case 'create':
    case 'write_file': {
      const path = sanitizeRelPath(String(r.path || r.file || ''));
      const content = String(r.content ?? r.contents ?? '');
      return path ? { type: 'create_file', path, content } : null;
    }
    case 'edit_file':
    case 'edit':
    case 'replace': {
      const path = sanitizeRelPath(String(r.path || r.file || ''));
      const find = String(r.find ?? r.search ?? '');
      const replace = String(r.replace ?? r.replacement ?? '');
      const content = r.content != null ? String(r.content) : undefined;
      return path ? { type: 'edit_file', path, find, replace, content } : null;
    }
    case 'delete_file':
    case 'delete': {
      const path = sanitizeRelPath(String(r.path || r.file || ''));
      return path ? { type: 'delete_file', path } : null;
    }
    case 'run_command':
    case 'command': {
      const command = String(r.command || '');
      return command ? { type: 'run_command', command } : null;
    }
    default:
      return null;
  }
}

export function buildDevSystemPrompt(projectName: string, fileOutline: string, contextFiles: string): string {
  return [
    'Voce e o Codnix Developer, o agente de desenvolvimento do CODNIX IDE.',
    `Projeto atual: "${projectName}".`,
    'Voce pode modificar o projeto emitindo acoes em blocos de codigo cercados por ```codnix .',
    'Formato exato (JSON, uma ou varias acoes):',
    '```codnix',
    '{"actions":[{"type":"create_file","path":"src/app.js","content":"// conteudo completo do arquivo"},{"type":"edit_file","path":"src/app.js","find":"trecho exato existente","replace":"novo trecho"},{"type":"delete_file","path":"caminho/arquivo.tmp"},{"type":"run_command","command":"npm install"}]}',
    '```',
    'Regras:',
    '- create_file cria (ou reescreve) um arquivo com conteudo COMPLETO.',
    '- edit_file substitui o trecho exato `find` por `replace` (use trechos unicos). Opcionalmente envie `content` completo.',
    '- delete_file remove um arquivo.',
    '- run_command sugere um comando de terminal (sera executado somente com aprovacao do usuario).',
    '- Explique suas mudancas em markdown FORA dos blocos codnix. Seja objetivo.',
    '- Nunca invente conteudo de arquivos: use o contexto fornecido.',
    '',
    'Estrutura do projeto (indice):',
    fileOutline,
    contextFiles ? `\nArquivos selecionados para contexto:\n${contextFiles}` : '',
  ].join('\n');
}
