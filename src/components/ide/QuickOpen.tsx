'use client';

import { useEffect, useMemo, useState } from 'react';
import { File as FileIcon } from 'lucide-react';
import { useApp } from '@/store/useAppStore';

export default function QuickOpen({ open, onClose }: { open: boolean; onClose: () => void }) {
  const files = useApp((s) => s.files);
  const [query, setQuery] = useState('');
  const [idx, setIdx] = useState(0);

  const paths = useMemo(() => Object.keys(files).filter((p) => !p.endsWith('.gitkeep')).sort(), [files]);
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return paths.filter((p) => p.toLowerCase().includes(q)).slice(0, 30);
  }, [paths, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setIdx(0);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-black/50 pt-[10vh]" onMouseDown={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-lg border border-edge bg-panel-2 shadow-2xl animate-slide-up" onMouseDown={(e) => e.stopPropagation()}>
        <input
          autoFocus
          className="w-full border-b border-edge bg-transparent px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-3"
          placeholder="Ir para arquivo... (Ctrl+P)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIdx(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setIdx((i) => Math.min(i + 1, filtered.length - 1));
            if (e.key === 'ArrowUp') setIdx((i) => Math.max(i - 1, 0));
            if (e.key === 'Enter' && filtered[idx]) {
              void useApp.getState().openFile(filtered[idx]);
              onClose();
            }
            if (e.key === 'Escape') onClose();
          }}
        />
        <div className="max-h-72 overflow-y-auto p-1">
          {filtered.map((p, i) => (
            <button
              key={p}
              className={`flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-xs ${i === idx ? 'bg-accent-soft text-ink' : 'text-ink-2 hover:bg-panel-3'}`}
              onMouseEnter={() => setIdx(i)}
              onClick={() => {
                void useApp.getState().openFile(p);
                onClose();
              }}
            >
              <FileIcon size={12} className="text-ink-3" />
              <span className="truncate">{p}</span>
            </button>
          ))}
          {filtered.length === 0 && <p className="p-4 text-center text-xs text-ink-3">Nenhum arquivo encontrado.</p>}
        </div>
      </div>
    </div>
  );
}
