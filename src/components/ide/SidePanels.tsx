'use client';

import { useEffect, useMemo, useState } from 'react';
import { File as FileIcon, GitBranch, Play, RefreshCw, Save, Search, Star } from 'lucide-react';
import { useApp } from '@/store/useAppStore';
import { apiJson } from '@/lib/api-client';
import { languageFor, LANGUAGES } from '@/lib/languages';
import { baseName } from '@/lib/utils';

export function SearchPanel() {
  const { projectId } = useApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ path: string; line: number; text: string; fileNameMatch?: boolean }[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = async (q?: string) => {
    const term = q ?? query;
    if (!term.trim() || !projectId) return;
    setSearching(true);
    try {
      const r = await apiJson<{ results: typeof results }>(`/api/projects/${projectId}/search?q=${encodeURIComponent(term)}`);
      setResults(r.results || []);
      setSearched(true);
    } catch {
      setResults([]);
    }
    setSearching(false);
  };

  useEffect(() => {
    const onSearch = (e: Event) => {
      const q = (e as CustomEvent<string>).detail;
      setQuery(q);
      void search(q);
    };
    window.addEventListener('codnix-search', onSearch);
    return () => window.removeEventListener('codnix-search', onSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return (
    <div className="flex h-full flex-col">
      <span className="codnix-panel-title px-3 py-2">Buscar em todo o projeto</span>
      <div className="px-3">
        <input
          className="codnix-input py-1.5 text-xs"
          placeholder="Buscar texto..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void search()}
        />
        <button className="codnix-btn-primary mt-2 w-full justify-center text-xs" onClick={() => void search()} disabled={searching}>
          <Search size={13} /> {searching ? 'Buscando...' : 'Buscar'}
        </button>
      </div>
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {results.map((r, i) => (
          <button
            key={`${r.path}-${r.line}-${i}`}
            className="flex w-full flex-col rounded px-2 py-1 text-left hover:bg-panel-2"
            onClick={() => useApp.getState().requestReveal(r.path, Math.max(r.line, 1))}
          >
            <span className="flex items-center gap-1.5 text-2xs font-medium text-ink">
              <FileIcon size={11} className="text-ink-3" /> {baseName(r.path)} {r.line > 0 && <span className="text-ink-3">· linha {r.line}</span>}
            </span>
            <span className="truncate font-mono text-2xs text-ink-3">{r.text}</span>
          </button>
        ))}
        {searched && results.length === 0 && !searching && <p className="p-3 text-center text-2xs text-ink-3">Nenhum resultado.</p>}
      </div>
    </div>
  );
}

export function GitPanel() {
  const { files, savedFiles, saveAllFiles, saveFile } = useApp();
  const changed = useMemo(
    () => Object.keys(files).filter((p) => files[p] !== savedFiles[p]),
    [files, savedFiles]
  );
  return (
    <div className="flex h-full flex-col">
      <span className="codnix-panel-title px-3 py-2">Alterações da sessão</span>
      <div className="flex items-center gap-2 px-3 pb-2 text-2xs text-ink-3">
        <GitBranch size={12} /> {changed.length} arquivo(s) não salvo(s)
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2">
        {changed.map((p) => (
          <button key={p} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-warn hover:bg-panel-2" onClick={() => void useApp.getState().openFile(p)}>
            <span className="min-w-0 flex-1 truncate">{p}</span>
            <span
              className="shrink-0 rounded bg-ok/15 px-1.5 py-0.5 text-2xs text-ok hover:bg-ok/25"
              onClick={async (e) => {
                e.stopPropagation();
                await saveFile(p);
              }}
            >
              salvar
            </span>
          </button>
        ))}
        {changed.length === 0 && <p className="p-3 text-center text-2xs text-ink-3">Nenhuma alteração pendente. ✔</p>}
      </div>
      {changed.length > 0 && (
        <div className="border-t border-edge p-2">
          <button className="codnix-btn-primary w-full justify-center text-xs" onClick={() => void saveAllFiles()}>
            <Save size={13} /> Salvar todos
          </button>
        </div>
      )}
    </div>
  );
}

export function RunPanel() {
  const { project, activeTab, runCommand, addOutput } = useApp();
  const [running, setRunning] = useState<string | null>(null);

  const files = Object.keys(useApp.getState().files);
  const has = (re: RegExp) => files.some((f) => re.test(f));

  const configs = useMemo(() => {
    const list: { id: string; label: string; cmd: string | null; desc: string }[] = [];
    if (has(/\.(cpp|cc|cxx)$/)) {
      list.push({
        id: 'cpp',
        label: 'Compilar e executar C++',
        cmd: 'mkdir -p bin && g++ -Iinclude src/*.cpp -o bin/app && ./bin/app',
        desc: 'g++ + execução do binário',
      });
    }
    if (has(/\.(c|h)$/)) {
      list.push({ id: 'c', label: 'Compilar e executar C', cmd: 'mkdir -p bin && gcc -Iinclude src/*.c -o bin/app && ./bin/app', desc: 'gcc + execução' });
    }
    if (has(/\.py$/)) {
      list.push({ id: 'py', label: 'Executar Python', cmd: 'python3 main.py', desc: 'python3 main.py' });
    }
    if (has(/package\.json$/)) {
      list.push({ id: 'npm-install', label: 'Instalar dependências', cmd: 'npm install', desc: 'npm install' });
      list.push({ id: 'npm-start', label: 'npm start', cmd: 'npm start', desc: 'roda o script start' });
      list.push({ id: 'npm-build', label: 'npm run build', cmd: 'npm run build', desc: 'build de produção' });
    }
    if (has(/\.js$/)) {
      list.push({ id: 'node', label: 'Executar com Node', cmd: 'node index.js', desc: 'node index.js' });
    }
    if (has(/\.html$/)) {
      list.push({ id: 'preview', label: 'Preview no navegador', cmd: null, desc: 'abra a aba Preview no painel inferior' });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  const run = async (id: string, cmd: string) => {
    setRunning(id);
    addOutput(`Executando: ${cmd}`, 'info');
    const result = await runCommand(cmd);
    setRunning(null);
    if (result) {
      addOutput(result.exitCode === 0 ? `Processo finalizado com sucesso (código: 0)` : `Processo finalizado com código ${result.exitCode}`, result.exitCode === 0 ? 'ok' : 'err');
    }
  };

  return (
    <div className="flex h-full flex-col">
      <span className="codnix-panel-title px-3 py-2">Executar e depurar</span>
      {activeTab && <p className="px-3 pb-2 text-2xs text-ink-3">Arquivo ativo: {baseName(activeTab)}</p>}
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-2 pb-2">
        {configs.map((c) => (
          <button
            key={c.id}
            className="flex w-full items-center gap-2 rounded-md border border-edge bg-panel-2 px-2.5 py-2 text-left hover:border-edge-strong disabled:opacity-50"
            onClick={() => (c.cmd ? void run(c.id, c.cmd) : addOutput('Abra a aba Preview no painel inferior para ver o HTML.', 'info'))}
            disabled={running !== null}
          >
            <Play size={13} className="shrink-0 accent-text" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs text-ink">{c.label}</span>
              <span className="block truncate text-2xs text-ink-3">{c.desc}</span>
            </span>
            {running === c.id && <RefreshCw size={12} className="animate-spin text-ink-3" />}
          </button>
        ))}
        {configs.length === 0 && <p className="p-3 text-center text-2xs text-ink-3">Nenhuma configuração de execução detectada para este projeto.</p>}
      </div>
    </div>
  );
}

export function ExtensionsPanel() {
  return (
    <div className="flex h-full flex-col">
      <span className="codnix-panel-title px-3 py-2">Linguagens suportadas</span>
      <div className="px-3 pb-2 text-2xs text-ink-3">
        Suporte nativo do editor Monaco — syntax highlighting, autocomplete e formatação.
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {LANGUAGES.filter((l) => l.monaco !== 'plaintext').map((l) => (
          <div key={l.label} className="flex items-center gap-2 rounded px-2 py-1.5 text-xs">
            <span className="h-2 w-2 rounded-full accent-bg" />
            <span className="flex-1 text-ink-2">{l.label}</span>
            <span className="text-2xs text-ink-3">{l.ext.join(', ')}</span>
            {l.runnable && <span className="rounded bg-panel-3 px-1 text-2xs text-ok">executável</span>}
          </div>
        ))}
      </div>
      <p className="border-t border-edge px-3 py-2 text-2xs text-ink-3">
        Marketplace de extensões: em roadmap. O CODNIX prioriza suporte nativo sem plugins de terceiros.
      </p>
    </div>
  );
}
