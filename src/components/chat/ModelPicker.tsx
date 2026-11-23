'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, RefreshCw, Search, Star, Zap } from 'lucide-react';
import { useChat } from '@/store/useChatStore';
import { useSettings } from '@/store/useSettingsStore';
import { formatContext, providerColor, providerLabel, searchModels } from '@/lib/model-utils';

// Seletor de modelos gratuitos do OpenRouter (pesquisa, favoritos, atualizar).
export default function ModelPicker({
  value,
  onChange,
  align = 'left',
  compact = false,
}: {
  value: string;
  onChange: (modelId: string) => void;
  align?: 'left' | 'right';
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { models, modelsLoading, modelsError, modelsFetchedAt, loadModels } = useChat();
  const { favorites, toggleFavorite } = useSettings();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && models.length === 0 && !modelsLoading) void loadModels();
  }, [open, models.length, modelsLoading, loadModels]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const list = useMemo(() => {
    const filtered = searchModels(models, query);
    const favs = filtered.filter((m) => favorites.includes(m.id));
    const rest = filtered.filter((m) => !favorites.includes(m.id));
    return { favs, rest };
  }, [models, query, favorites]);

  const current = models.find((m) => m.id === value);

  const renderItem = (m: (typeof models)[number]) => (
    <button
      key={m.id}
      onClick={() => {
        onChange(m.id);
        setOpen(false);
      }}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-panel-3 ${value === m.id ? 'bg-accent-soft' : ''}`}
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: providerColor(m.provider) }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs text-ink">{m.name}</span>
        <span className="block truncate text-2xs text-ink-3">{m.id}</span>
      </span>
      <span className="shrink-0 text-2xs text-ink-3">{formatContext(m.contextLength)}</span>
      <Star
        size={12}
        className={`shrink-0 ${favorites.includes(m.id) ? 'fill-warn text-warn' : 'text-ink-3'}`}
        onClick={(e) => {
          e.stopPropagation();
          toggleFavorite(m.id);
        }}
      />
      {value === m.id && <Check size={13} className="accent-text shrink-0" />}
    </button>
  );

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="codnix-chip max-w-full"
        title={value || 'Selecionar modelo'}
      >
        {!compact && <span className="h-2 w-2 rounded-full" style={{ background: current ? providerColor(current.provider) : '#666' }} />}
        <span className="truncate">{current ? current.name : value ? value.split('/').pop() : 'Selecionar modelo'}</span>
        <ChevronDown size={12} />
      </button>

      {open && (
        <div
          className={`absolute z-50 mt-1 flex max-h-[420px] w-[320px] flex-col overflow-hidden rounded-lg border border-edge bg-panel-2 shadow-2xl animate-fade-in ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <div className="flex items-center gap-2 border-b border-edge px-3 py-2">
            <Search size={13} className="text-ink-3" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar modelos gratuitos..."
              className="w-full bg-transparent text-xs text-ink outline-none placeholder:text-ink-3"
            />
            <button
              onClick={() => void loadModels(true)}
              title="Atualizar lista de modelos"
              className="text-ink-3 hover:text-ink"
            >
              <RefreshCw size={13} className={modelsLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="min-h-[60px] flex-1 overflow-y-auto py-1">
            {modelsLoading && models.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-ink-3">Carregando modelos do OpenRouter...</p>
            )}
            {modelsError && models.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-err">{modelsError}</p>
            )}
            {!modelsLoading && models.length === 0 && !modelsError && (
              <p className="px-3 py-6 text-center text-xs text-ink-3">Nenhum modelo carregado. Clique em atualizar.</p>
            )}
            {list.favs.length > 0 && (
              <>
                <p className="codnix-panel-title px-3 pb-1 pt-2">Favoritos</p>
                {list.favs.map(renderItem)}
                <p className="codnix-panel-title px-3 pb-1 pt-2">Todos os gratuitos ({models.length})</p>
              </>
            )}
            {list.rest.map(renderItem)}
          </div>

          <div className="flex items-center gap-1.5 border-t border-edge px-3 py-1.5 text-2xs text-ink-3">
            <Zap size={11} className="text-ok" /> Somente modelos gratuitos do OpenRouter · atualizado {modelsFetchedAt ? new Date(modelsFetchedAt).toLocaleTimeString('pt-BR') : '—'}
          </div>
        </div>
      )}
    </div>
  );
}
