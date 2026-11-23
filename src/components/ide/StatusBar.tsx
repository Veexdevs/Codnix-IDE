'use client';

import { AlertTriangle, Bot, GitBranch, XCircle } from 'lucide-react';
import { useApp } from '@/store/useAppStore';
import { languageFor } from '@/lib/languages';
import { useSettings } from '@/store/useSettingsStore';

export default function StatusBar({ onOpenProblems }: { onOpenProblems: () => void }) {
  const { project, cursor, markers, activeTab } = useApp();
  const tabSize = useSettings((s) => s.editor.tabSize);
  const errors = markers.filter((m) => m.severity === 'error').length;
  const warnings = markers.filter((m) => m.severity === 'warning').length;
  const lang = activeTab ? languageFor(activeTab) : null;

  return (
    <div className="flex h-6 shrink-0 items-center gap-3 border-t border-edge bg-panel px-3 text-2xs text-ink-3">
      <span className="flex items-center gap-1">
        <GitBranch size={11} /> {project?.name || 'sem projeto'}
      </span>
      <span className="flex items-center gap-1">
        <Bot size={11} className="accent-text" /> Codnix Assistant pronto
      </span>
      <button className="flex items-center gap-1 hover:text-ink" onClick={onOpenProblems}>
        <XCircle size={11} className={errors ? 'text-err' : ''} /> {errors}
        <AlertTriangle size={11} className={warnings ? 'text-warn' : ''} /> {warnings}
      </button>
      <div className="flex-1" />
      <span>
        Ln {cursor.line}, Col {cursor.col}
      </span>
      <span>Espaços: {tabSize}</span>
      <span>UTF-8</span>
      <span>LF</span>
      <span>{lang?.label || 'Texto'}</span>
    </div>
  );
}
