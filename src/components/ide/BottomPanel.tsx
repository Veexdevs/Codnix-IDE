'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, RefreshCw, XCircle } from 'lucide-react';
import TerminalPanel from './TerminalPanel';
import { useApp } from '@/store/useAppStore';
import { baseName } from '@/lib/utils';

export type BottomTab = 'terminal' | 'saida' | 'problemas' | 'console' | 'preview';

export default function BottomPanel({
  tab,
  setTab,
  collapsed,
  setCollapsed,
}: {
  tab: BottomTab;
  setTab: (t: BottomTab) => void;
  collapsed: boolean;
  setCollapsed: (c: boolean) => void;
}) {
  const { markers, outputLines, consoleLines, projectId, clearConsole } = useApp();
  const [previewKey, setPreviewKey] = useState(0);

  const errors = useMemo(() => markers.filter((m) => m.severity === 'error').length, [markers]);
  const warnings = useMemo(() => markers.filter((m) => m.severity === 'warning').length, [markers]);
  const files = useApp((st) => st.files);
  const hasPreview = useMemo(() => Object.keys(files).some((p) => p.endsWith('.html')), [files]);

  const TABS: { id: BottomTab; label: string }[] = [
    { id: 'terminal', label: 'Terminal' },
    { id: 'saida', label: 'Saída' },
    { id: 'problemas', label: 'Problemas' },
    { id: 'console', label: 'Console IA' },
    ...(hasPreview ? [{ id: 'preview' as BottomTab, label: 'Preview' }] : []),
  ];

  return (
    <div className="flex h-full flex-col border-t border-edge bg-panel">
      <div className="flex h-8 shrink-0 items-center gap-0.5 px-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              setCollapsed(false);
            }}
            className={`rounded px-2.5 py-1 text-2xs font-medium uppercase tracking-wide ${
              tab === t.id && !collapsed ? 'border-b-2 border-accent text-ink' : 'text-ink-3 hover:text-ink-2'
            }`}
          >
            {t.label}
            {t.id === 'problemas' && errors + warnings > 0 && (
              <span className={`ml-1.5 rounded-full px-1.5 text-2xs ${errors > 0 ? 'bg-err/20 text-err' : 'bg-warn/20 text-warn'}`}>
                {errors + warnings}
              </span>
            )}
          </button>
        ))}
        <div className="flex-1" />
        {tab === 'preview' && !collapsed && (
          <button className="rounded p-1 text-ink-3 hover:text-ink" title="Recarregar preview" onClick={() => setPreviewKey((k) => k + 1)}>
            <RefreshCw size={12} />
          </button>
        )}
        <button className="rounded p-1 text-ink-3 hover:text-ink" onClick={() => setCollapsed(!collapsed)} title={collapsed ? 'Expandir' : 'Minimizar'}>
          {collapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {!collapsed && (
        <div className="min-h-0 flex-1">
          {tab === 'terminal' && <TerminalPanel />}
          {tab === 'saida' && <OutputList lines={outputLines} empty="Sem eventos. Ações do IDE aparecem aqui." />}
          {tab === 'console' && (
            <div className="relative h-full">
              <OutputList lines={consoleLines} empty="Sem atividades de IA. Execuções de agentes aparecem aqui." />
              <button className="absolute right-2 top-2 rounded p-1 text-ink-3 hover:text-ink" title="Limpar console" onClick={clearConsole}>
                <XCircle size={13} />
              </button>
            </div>
          )}
          {tab === 'problemas' && (
            <div className="h-full overflow-y-auto px-3 py-1.5">
              {markers.length === 0 ? (
                <p className="py-6 text-center text-2xs text-ink-3">Nenhum problema detectado. ✔</p>
              ) : (
                markers.map((m, i) => (
                  <button
                    key={`${m.path}-${m.line}-${i}`}
                    className="flex w-full items-start gap-2 rounded px-1 py-1 text-left text-xs hover:bg-panel-2"
                    onClick={() => useApp.getState().requestReveal(m.path, m.line)}
                  >
                    {m.severity === 'error' ? <XCircle size={13} className="mt-0.5 shrink-0 text-err" /> : <AlertTriangle size={13} className="mt-0.5 shrink-0 text-warn" />}
                    <span className="min-w-0 flex-1">
                      <span className="text-ink-2">{m.message}</span>
                      <span className="block text-2xs text-ink-3">
                        {baseName(m.path)} · linha {m.line}:{m.col}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
          {tab === 'preview' && projectId && (
            <iframe
              key={previewKey}
              src={`/api/preview/${projectId}/index.html`}
              className="h-full w-full border-0 bg-white"
              title="Preview do projeto"
              sandbox="allow-scripts allow-forms"
            />
          )}
          {tab === 'preview' && !projectId && <p className="py-6 text-center text-2xs text-ink-3">Abra um projeto para visualizar.</p>}
        </div>
      )}
    </div>
  );
}

function OutputList({ lines, empty }: { lines: { id: string; at: string; text: string; kind: string }[]; empty: string }) {
  return (
    <div className="h-full overflow-y-auto px-3 py-1.5 font-mono text-2xs leading-relaxed">
      {lines.length === 0 ? (
        <p className="py-6 text-center text-2xs text-ink-3">{empty}</p>
      ) : (
        lines.map((l) => (
          <div key={l.id} className={`flex gap-2 ${l.kind === 'err' ? 'text-err' : l.kind === 'ok' ? 'text-ok' : l.kind === 'warn' ? 'text-warn' : 'text-ink-2'}`}>
            <span className="shrink-0 text-ink-3">{new Date(l.at).toLocaleTimeString('pt-BR')}</span>
            <span className="whitespace-pre-wrap break-words">{l.text}</span>
          </div>
        ))
      )}
    </div>
  );
}
