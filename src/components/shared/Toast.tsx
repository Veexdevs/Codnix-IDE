'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { useSettings } from '@/store/useSettingsStore';

interface ToastItem {
  id: number;
  text: string;
  kind: 'ok' | 'err' | 'info';
}
let nextId = 1;

interface ToastStore {
  items: ToastItem[];
  show(text: string, kind?: ToastItem['kind']): void;
  dismiss(id: number): void;
}
export const useToast = create<ToastStore>((set, get) => ({
  items: [],
  show: (text, kind = 'info') => {
    const id = nextId++;
    set({ items: [...get().items, { id, text, kind }] });
    setTimeout(() => get().dismiss(id), 4000);
  },
  dismiss: (id) => set({ items: get().items.filter((t) => t.id !== id) }),
}));

export function ToastHost() {
  const items = useToast((s) => s.items);
  const dismiss = useToast((s) => s.dismiss);
  const accent = useSettings((s) => s.accent);
  useEffect(() => {
    document.documentElement.dataset.accent = accent;
  }, [accent]);
  return (
    <div className="pointer-events-none fixed bottom-20 left-1/2 z-[200] flex -translate-x-1/2 flex-col items-center gap-2 md:bottom-6">
      {items.map((t) => (
        <div
          key={t.id}
          onClick={() => dismiss(t.id)}
          className="pointer-events-auto flex max-w-[90vw] cursor-pointer items-center gap-2 rounded-lg border border-edge bg-panel-3 px-3 py-2 text-xs text-ink shadow-xl animate-slide-up"
        >
          {t.kind === 'ok' && <CheckCircle2 size={14} className="text-ok" />}
          {t.kind === 'err' && <XCircle size={14} className="text-err" />}
          {t.kind === 'info' && <Info size={14} className="accent-text" />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}
