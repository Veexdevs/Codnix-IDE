'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { editor } from 'monaco-editor';
import { Check, Replace, Search, WrapText, X } from 'lucide-react';
import { useApp } from '@/store/useAppStore';
import { useSettings } from '@/store/useSettingsStore';
import { languageFor } from '@/lib/languages';
import { baseName } from '@/lib/utils';
import { useToast } from '@/components/shared/Toast';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-xs text-ink-3">Carregando editor Monaco...</div>
  ),
});

function defineTheme(monaco: typeof import('monaco-editor')) {
  monaco.editor.defineTheme('codnix-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6e6e78', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'c678dd' },
      { token: 'string', foreground: '98c379' },
      { token: 'number', foreground: 'd19a66' },
      { token: 'type', foreground: 'e5c07b' },
      { token: 'function', foreground: '61afef' },
      { token: 'variable', foreground: 'e06c75' },
    ],
    colors: {
      'editor.background': '#0d0d0f',
      'editor.foreground': '#e8e8ec',
      'editorLineNumber.foreground': '#3d3d44',
      'editorLineNumber.activeForeground': '#8a8a92',
      'editor.selectionBackground': '#2f7bff33',
      'editor.lineHighlightBackground': '#141416',
      'editorCursor.foreground': '#2f7bff',
      'editorIndentGuide.background1': '#1c1c1f',
      'editorWidget.background': '#161618',
      'editorWidget.border': '#232327',
      'editorSuggestWidget.background': '#161618',
      'editorSuggestWidget.selectedBackground': '#2f7bff33',
      'minimap.background': '#0d0d0f',
    },
  });
  monaco.editor.setTheme('codnix-dark');
}

export default function EditorPane() {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null);
  const { files, activeTab, updateFileContent, setCursor, setMarkers, project, projectId, openTabs } = useApp();
  const settings = useSettings((s) => s.editor);
  const toast = useToast((s) => s.show);
  const wordWrapOn = settings.wordWrap;

  // Markers do Monaco -> painel Problemas
  useEffect(() => {
    if (!monacoRef.current) return;
    const monaco = monacoRef.current;
    const dispose = monaco.editor.onDidChangeMarkers(() => {
      const all = monaco.editor.getModelMarkers({});
      const mapped = all
        .map((m) => {
          const path = decodeURIComponent((m.resource.path || '').replace(/^\/workspaces?\//, '').replace(/^\//, ''));
          return {
            path: path || project?.name || '',
            line: m.startLineNumber,
            col: m.startColumn,
            severity: (m.severity === 8 ? 'error' : m.severity === 4 ? 'warning' : 'info') as 'error' | 'warning' | 'info',
            message: m.message,
          };
        })
        .slice(0, 200);
      setMarkers(mapped);
    });
    return () => dispose.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!monacoRef.current]);

  // Revelar linha solicitada (busca no projeto / problemas)
  const reveal = useApp((s) => s.revealRequest);
  useEffect(() => {
    if (!reveal || !editorRef.current) return;
    const ed = editorRef.current;
    const model = ed.getModel();
    if (model && model.uri.path.endsWith(`/${reveal.path}`)) {
      ed.revealLineInCenter(reveal.line);
      ed.setPosition({ lineNumber: reveal.line, column: 1 });
      ed.focus();
    } else {
      void useApp.getState().openFile(reveal.path).then(() => {
        setTimeout(() => {
          const m2 = editorRef.current?.getModel();
          if (m2 && editorRef.current) {
            editorRef.current.revealLineInCenter(reveal.line);
            editorRef.current.setPosition({ lineNumber: reveal.line, column: 1 });
            editorRef.current.focus();
          }
        }, 120);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal?.nonce]);

  const lang = activeTab ? languageFor(activeTab) : null;

  const runAction = (actionId: string, label: string) => {
    const ed = editorRef.current;
    if (!ed) return;
    const action = ed.getAction(actionId);
    if (action) void action.run();
    else toast(`${label} não disponível para ${lang?.label || 'este arquivo'}`, 'info');
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Abas */}
      <div className="flex h-9 shrink-0 items-center border-b border-edge bg-panel">
        <div className="flex min-w-0 flex-1 items-center overflow-x-auto">
          {openTabs.map((tab) => (
            <TabButton key={tab} path={tab} />
          ))}
          {openTabs.length === 0 && (
            <span className="px-3 text-2xs text-ink-3">Nenhum arquivo aberto — use o Explorer ou Ctrl+P</span>
          )}
        </div>
        {activeTab && (
          <div className="flex shrink-0 items-center gap-0.5 border-l border-edge px-1.5">
            <button className="rounded p-1.5 text-ink-3 hover:text-ink" title="Formatar documento (Shift+Alt+F)" onClick={() => runAction('editor.action.formatDocument', 'Formatação')}>
              <Check size={14} />
            </button>
            <button className="rounded p-1.5 text-ink-3 hover:text-ink" title="Buscar (Ctrl+F)" onClick={() => runAction('actions.find', 'Busca')}>
              <Search size={14} />
            </button>
            <button className="rounded p-1.5 text-ink-3 hover:text-ink" title="Substituir (Ctrl+H)" onClick={() => runAction('editor.action.startFindReplaceAction', 'Substituição')}>
              <Replace size={14} />
            </button>
            <button
              className="rounded p-1.5 text-ink-3 hover:text-ink"
              title="Alternar quebra de linha (Alt+Z)"
              onClick={() => {
                const wrap = !useSettings.getState().editor.wordWrap;
                useSettings.getState().set('editor', { ...useSettings.getState().editor, wordWrap: wrap });
                toast(`Quebra de linha ${wrap ? 'ativada' : 'desativada'}`, 'info');
              }}
            >
              <WrapText size={14} className={wordWrapOn ? 'accent-text' : ''} />
            </button>
          </div>
        )}
      </div>

      {/* Monaco */}
      {activeTab && files[activeTab] !== undefined ? (
        <MonacoEditor
          key={activeTab}
          height="100%"
          theme="codnix-dark"
          language={lang?.monaco}
          value={files[activeTab]}
          onChange={(v) => updateFileContent(activeTab, v ?? '')}
          beforeMount={defineTheme}
          onMount={(ed, monaco) => {
            editorRef.current = ed;
            monacoRef.current = monaco;
            ed.onDidChangeCursorPosition((e) => setCursor(e.position.lineNumber, e.position.column));
            ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
              void useApp.getState().saveFile();
            });
            ed.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.KeyZ, () => {
              const st = useSettings.getState();
              st.set('editor', { ...st.editor, wordWrap: !st.editor.wordWrap });
            });
          }}
          options={{
            fontSize: settings.fontSize,
            tabSize: settings.tabSize,
            wordWrap: settings.wordWrap ? 'on' : 'off',
            minimap: { enabled: settings.minimap },
            automaticLayout: true,
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            renderLineHighlight: 'all',
            padding: { top: 10 },
            bracketPairColorization: { enabled: true },
            guides: { bracketPairs: true },
          }}
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <span className="text-3xl font-bold tracking-widest text-panel-3">CODNIX</span>
          <p className="max-w-xs text-xs text-ink-3">
            {projectId ? 'Selecione um arquivo no Explorer, use Ctrl+P para busca rápida, ou peça à IA para criar algo novo.' : 'Nenhum projeto aberto. Volte aos Projetos e abra um.'}
          </p>
        </div>
      )}
    </div>
  );
}

function TabButton({ path }: { path: string }) {
  const { activeTab, setActiveTab, closeTab, files, savedFiles } = useApp();
  const isActive = activeTab === path;
  const isDirty = files[path] !== savedFiles[path];
  return (
    <div
      className={`group flex h-full max-w-[180px] shrink-0 cursor-pointer items-center gap-1.5 border-r border-edge px-3 text-xs ${
        isActive ? 'border-t-2 border-t-accent bg-base text-ink' : 'bg-panel text-ink-2 hover:bg-panel-2'
      }`}
      onClick={() => setActiveTab(path)}
    >
      <span className="truncate">{baseName(path)}</span>
      {isDirty && <span className="h-1.5 w-1.5 shrink-0 rounded-full text-warn" style={{ background: '#d29922' }} />}
      <button
        className="shrink-0 rounded p-0.5 text-ink-3 opacity-0 hover:bg-panel-3 hover:text-ink group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          closeTab(path);
        }}
        title="Fechar"
      >
        <X size={11} />
      </button>
    </div>
  );
}
