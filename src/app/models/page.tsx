'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Image as ImageIcon, RefreshCw, Search, Star, Zap } from 'lucide-react';
import Logo from '@/components/shared/Logo';
import MobileNav from '@/components/shared/MobileNav';
import { ToastHost, useToast } from '@/components/shared/Toast';
import { useChat } from '@/store/useChatStore';
import { useSettings } from '@/store/useSettingsStore';
import { formatContext, providerColor, providerLabel } from '@/lib/model-utils';

export default function ModelsPage() {
  const { models, modelsLoading, modelsError, modelsFetchedAt, loadModels } = useChat();
  const { favorites, toggleFavorite, defaultModel, set } = useSettings();
  const toast = useToast((s) => s.show);
  const [query, setQuery] = useState('');
  const [onlyFav, setOnlyFav] = useState(false);
  const [providerFilter, setProviderFilter] = useState('');

  useEffect(() => {
    if (models.length === 0) void loadModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const providers = useMemo(() => {
    const set_ = new Map<string, number>();
    for (const m of models) set_.set(m.provider, (set_.get(m.provider) || 0) + 1);
    return Array.from(set_.entries()).sort((a, b) => b[1] - a[1]);
  }, [models]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    let l = models;
    if (onlyFav) l = l.filter((m) => favorites.includes(m.id));
    if (providerFilter) l = l.filter((m) => m.provider === providerFilter);
    if (q) l = l.filter((m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q));
    return l;
  }, [models, query, onlyFav, providerFilter, favorites]);

  return (
    <div className="flex min-h-dvh flex-col bg-base">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-edge px-4">
        <Link href="/" className="text-ink-2 hover:text-ink"><ArrowLeft size={18} /></Link>
        <Logo size={22} withText />
        <span className="text-xs text-ink-3">· Modelos gratuitos</span>
        <div className="flex-1" />
        <button
          className="codnix-btn-ghost text-xs"
          onClick={() => {
            void loadModels(true);
            toast('Lista de modelos atualizada', 'ok');
          }}
        >
          <RefreshCw size={13} className={modelsLoading ? 'animate-spin' : ''} /> Atualizar
        </button>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-5 pb-20">
        <div className="mb-4 rounded-lg border border-edge bg-panel p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
              <input className="codnix-input py-1.5 pl-8 text-xs" placeholder="Pesquisar por nome ou id..." value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <select className="codnix-select" value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)}>
              <option value="">Todos os fornecedores</option>
              {providers.map(([p, n]) => (
                <option key={p} value={p}>{providerLabel(p)} ({n})</option>
              ))}
            </select>
            <button className={`codnix-btn-ghost text-xs ${onlyFav ? 'accent-border accent-text' : ''}`} onClick={() => setOnlyFav((f) => !f)}>
              <Star size={13} className={onlyFav ? 'fill-warn text-warn' : ''} /> Favoritos
            </button>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-2xs text-ink-3">
            <Zap size={11} className="text-ok" />
            {models.length} modelos gratuitos disponíveis · carregado dinamicamente do OpenRouter
            {modelsFetchedAt ? ` (${new Date(modelsFetchedAt).toLocaleTimeString('pt-BR')})` : ''}
          </p>
        </div>

        {modelsLoading && models.length === 0 && <p className="py-10 text-center text-xs text-ink-3">Carregando modelos...</p>}
        {modelsError && models.length === 0 && <p className="py-10 text-center text-xs text-err">{modelsError}</p>}

        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {list.map((m) => (
            <div key={m.id} className={`group rounded-lg border p-3 transition-colors ${defaultModel === m.id ? 'accent-border' : 'border-edge hover:border-edge-strong'} bg-panel`}>
              <div className="flex items-start gap-2">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: providerColor(m.provider) }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.name}</p>
                  <p className="truncate font-mono text-2xs text-ink-3">{m.id}</p>
                  {m.description && <p className="mt-1 line-clamp-2 text-2xs text-ink-2">{m.description}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-2xs text-ink-3">
                    <span className="rounded bg-panel-3 px-1.5 py-0.5">{providerLabel(m.provider)}</span>
                    <span className="rounded bg-panel-3 px-1.5 py-0.5">ctx {formatContext(m.contextLength)}</span>
                    {m.imageInput && <span className="flex items-center gap-0.5 rounded bg-panel-3 px-1.5 py-0.5"><ImageIcon size={10} /> imagem</span>}
                    <span className="rounded bg-ok/10 px-1.5 py-0.5 text-ok">grátis</span>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <button onClick={() => toggleFavorite(m.id)} className="text-ink-3 hover:text-warn" title="Favoritar">
                    <Star size={14} className={favorites.includes(m.id) ? 'fill-warn text-warn' : ''} />
                  </button>
                  <button
                    onClick={() => {
                      set('defaultModel', m.id);
                      toast(`Modelo padrão: ${m.name}`, 'ok');
                    }}
                    className={`rounded px-2 py-1 text-2xs ${defaultModel === m.id ? 'accent-text accent-soft-bg' : 'text-ink-3 hover:text-ink'}`}
                    title="Definir como modelo padrão"
                  >
                    {defaultModel === m.id ? 'padrão' : 'usar'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {!modelsLoading && list.length === 0 && models.length > 0 && (
          <p className="py-10 text-center text-xs text-ink-3">Nenhum modelo corresponde à pesquisa.</p>
        )}
      </main>

      <MobileNav />
      <ToastHost />
    </div>
  );
}
