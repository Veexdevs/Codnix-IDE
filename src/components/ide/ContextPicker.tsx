'use client';

import { useMemo, useState } from 'react';
import { Check, File as FileIcon, FolderOpen, RefreshCw, Search } from 'lucide-react';
import Modal from '@/components/shared/Modal';
import { useApp } from '@/store/useAppStore';
import { useSettings } from '@/store/useSettingsStore';
import { apiJson } from '@/lib/api-client';
import { useToast } from '@/components/shared/Toast';

export default function ContextPicker({
  open,
  onClose,
  selected,
  onChange,
  outline,
  onReindex,
  reindexing,
}: {
  open: boolean;
  onClose: () => void;
  selected: string[];
  onChange: (paths: string[]) => void;
  outline: string | null;
  onReindex: () => void;
  reindexing?: boolean;
}) {
  const files = useApp((s) => s.files);
  const toast = useToast((s) => s.show);
  const [query, setQuery] = useState('');

  const paths = useMemo(() => Object.keys(files).filter((p) => !p.endsWith('.gitkeep')).sort(), [files]);
  const filtered = useMemo(() => paths.filter((p) => p.toLowerCase().includes(query.toLowerCase())), [paths, query]);

  const toggle = (p: string) => {
    onChange(selected.includes(p) ? selected.filter((x) => x !== p) : [...selected, p]);
  };

  return (
    <Modal open={open} onClose={onClose} title="Contexto do projeto para as IAs" width={520}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[160px] flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input className="codnix-input py-1.5 pl-8 text-xs" placeholder="Filtrar arquivos..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <button className="codnix-btn-ghost text-xs" onClick={onReindex} title="Indexar estrutura do projeto para contexto">
          <RefreshCw size={13} className={reindexing ? 'animate-spin' : ''} /> Indexar projeto
        </button>
        <button className="codnix-btn-ghost text-xs" onClick={() => onChange([])}>Limpar seleção</button>
      </div>

      {outline && (
        <div className="mb-3 max-h-28 overflow-auto rounded-md border border-edge bg-panel p-2 font-mono text-2xs text-ink-3">
          <p className="mb-1 font-sans font-semibold text-ink-2">Índice do projeto (enviado às IAs):</p>
          {outline.split('\n').slice(0, 12).join('\n')}
          {outline.split('\n').length > 12 ? '\n...' : ''}
        </div>
      )}

      <div className="max-h-64 overflow-y-auto rounded-md border border-edge">
        {filtered.map((p) => {
          const checked = selected.includes(p);
          return (
            <button key={p} onClick={() => toggle(p)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-ink-2 hover:bg-panel-2">
              <span className={`flex h-3.5 w-3.5 items-center justify-center rounded border ${checked ? 'accent-border accent-soft-bg' : 'border-edge-strong'}`}>
                {checked && <Check size={10} className="accent-text" />}
              </span>
              <FileIcon size={12} className="shrink-0 text-ink-3" />
              <span className="min-w-0 flex-1 truncate">{p}</span>
              <span className="shrink-0 text-2xs text-ink-3">{(files[p]?.length || 0) > 8000 ? 'grande' : ''}</span>
            </button>
          );
        })}
        {filtered.length === 0 && <p className="p-4 text-center text-xs text-ink-3">Nenhum arquivo.</p>}
      </div>

      <div className="mt-3 flex items-center justify-between text-2xs text-ink-3">
        <span className="flex items-center gap-1">
          <FolderOpen size={12} /> {selected.length} arquivos no contexto
        </span>
        <span>Orçamento: ~{Math.round(useSettings.getState().contextBudget / 1000)}K caracteres</span>
      </div>
      <button className="codnix-btn-primary mt-3 w-full justify-center" onClick={onClose}>
        Confirmar contexto
      </button>
    </Modal>
  );
}
