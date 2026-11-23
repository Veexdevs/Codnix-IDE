export interface LanguageDef {
  ext: string[];
  monaco: string;
  label: string;
  runnable?: 'node' | 'python' | 'cpp' | 'c' | 'rust' | 'go' | 'php' | 'ruby' | 'lua';
  previewable?: boolean;
}

export const LANGUAGES: LanguageDef[] = [
  { ext: ['html', 'htm'], monaco: 'html', label: 'HTML', previewable: true },
  { ext: ['css'], monaco: 'css', label: 'CSS', previewable: true },
  { ext: ['js', 'mjs', 'cjs'], monaco: 'javascript', label: 'JavaScript', runnable: 'node', previewable: true },
  { ext: ['ts', 'tsx'], monaco: 'typescript', label: 'TypeScript' },
  { ext: ['jsx'], monaco: 'javascript', label: 'JavaScript JSX', runnable: 'node' },
  { ext: ['py'], monaco: 'python', label: 'Python', runnable: 'python' },
  { ext: ['c', 'h'], monaco: 'c', label: 'C', runnable: 'c' },
  { ext: ['cpp', 'hpp', 'cc', 'cxx'], monaco: 'cpp', label: 'C++', runnable: 'cpp' },
  { ext: ['cs'], monaco: 'csharp', label: 'C#' },
  { ext: ['java'], monaco: 'java', label: 'Java' },
  { ext: ['kt', 'kts'], monaco: 'kotlin', label: 'Kotlin' },
  { ext: ['swift'], monaco: 'swift', label: 'Swift' },
  { ext: ['php'], monaco: 'php', label: 'PHP', runnable: 'php' },
  { ext: ['rs'], monaco: 'rust', label: 'Rust', runnable: 'rust' },
  { ext: ['go'], monaco: 'go', label: 'Go', runnable: 'go' },
  { ext: ['lua'], monaco: 'lua', label: 'Lua', runnable: 'lua' },
  { ext: ['rb'], monaco: 'ruby', label: 'Ruby', runnable: 'ruby' },
  { ext: ['json'], monaco: 'json', label: 'JSON' },
  { ext: ['xml'], monaco: 'xml', label: 'XML' },
  { ext: ['yaml', 'yml'], monaco: 'yaml', label: 'YAML' },
  { ext: ['md', 'markdown'], monaco: 'markdown', label: 'Markdown' },
  { ext: ['sh', 'bash'], monaco: 'shell', label: 'Shell' },
  { ext: ['sql'], monaco: 'sql', label: 'SQL' },
  { ext: ['txt'], monaco: 'plaintext', label: 'Texto' },
];

export function languageFor(path: string): LanguageDef {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  return LANGUAGES.find((l) => l.ext.includes(ext)) || ({ ext: [ext], monaco: 'plaintext', label: 'Texto' } as LanguageDef);
}
