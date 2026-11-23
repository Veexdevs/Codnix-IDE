'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Atom, Binary, FileCode, Globe, Hexagon, LayoutTemplate, MessageSquare, Plus,
  Search, Server, Settings2, Star, Terminal, Trash2, FolderOpen, History, Layers,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Logo from '@/components/shared/Logo';
import Modal from '@/components/shared/Modal';
import MobileNav from '@/components/shared/MobileNav';
import { ToastHost, useToast } from '@/components/shared/Toast';
import { apiJson } from '@/lib/api-client';
import { timeAgo } from '@/lib/utils';
import { TEMPLATES } from '@/lib/templates';
import { providerColor } from '@/lib/model-utils';
import type { ProjectMeta } from '@/types';

const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  cpp: Binary,
  'web-app': Globe,
  'html-site': FileCode,
  'react-app': Atom,
  'python-app': Terminal,
  'rest-api': Server,
  'node-app': Hexagon,
};

export default function HomePage() {
  const router = useRouter();
  const toast = useToast((s) => s.show);
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showFavorites, setShowFavorites] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTemplate, setNewTemplate] = useState('cpp');
  const [newDesc, setNewDesc] = useState('');

  const load = async () => {
    try {
      const r = await apiJson<{ projects: ProjectMeta[] }>('/api/projects');
      setProjects(r.projects || []);
    } catch {
      toast('Falha ao carregar projetos', 'err');
    }
    setLoading(false);
  };

  useEffect(() => {
    // garante projeto demo inicial
    void apiJson<{ seeded: boolean }>('/api/projects', { method: 'PATCH' })
      .then(() => load())
      .catch(() => load());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    let list = projects;
    if (showFavorites) list = list.filter((p) => p.favorite);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q) || p.template.includes(q));
    return list;
  }, [projects, query, showFavorites]);

  const openProject = (id: string) => {
    try {
      const saved = JSON.parse(localStorage.getItem('codnix-app') || '{}');
      localStorage.setItem('codnix-app', JSON.stringify({ ...saved, state: { ...saved.state, projectId: id } }));
    } catch { /* ignore */ }
    router.push('/ide');
  };

  const createProject = async () => {
    if (!newName.trim()) return;
    try {
      const r = await apiJson<{ project: ProjectMeta }>('/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim(), template: newTemplate, description: newDesc }),
      });
      setCreateOpen(false);
      setNewName('');
      setNewDesc('');
      toast(`Projeto "${r.project.name}" criado`, 'ok');
      openProject(r.project.id);
    } catch (e) {
      toast(`Falha ao criar projeto: ${(e as Error).message}`, 'err');
    }
  };

  const toggleFavorite = async (p: ProjectMeta) => {
    try {
      await apiJson(`/api/projects/${p.id}`, { method: 'PATCH', body: JSON.stringify({ favorite: !p.favorite }) });
      setProjects((prev) => prev.map((x) => (x.id === p.id ? { ...x, favorite: !x.favorite } : x)));
    } catch { /* ignore */ }
  };

  const removeProject = async (p: ProjectMeta) => {
    if (!confirm(`Excluir o projeto "${p.name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await apiJson(`/api/projects/${p.id}`, { method: 'DELETE' });
      setProjects((prev) => prev.filter((x) => x.id !== p.id));
      toast('Projeto excluído', 'ok');
    } catch {
      toast('Falha ao excluir', 'err');
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-base">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-edge px-4">
        <Logo size={26} withText />
        <span className="hidden text-2xs text-ink-3 sm:inline">Multiple Models. One Development Environment.</span>
        <div className="flex-1" />
        <nav className="flex items-center gap-1 text-xs">
          <a href="/chat" className="codnix-btn-ghost text-xs"><MessageSquare size={13} /> Chat</a>
          <a href="/models" className="codnix-btn-ghost text-xs"><Layers size={13} /> Modelos</a>
          <a href="/settings" className="codnix-btn-ghost text-xs"><Settings2 size={13} /> <span className="hidden sm:inline">Configurações</span></a>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {/* Hero */}
        <section className="mb-8 rounded-xl border border-edge bg-panel p-6 text-center">
          <Logo size={44} />
          <h1 className="mt-3 text-xl font-semibold md:text-2xl">CODNIX IDE</h1>
          <p className="mx-auto mt-1 max-w-md text-xs text-ink-2 md:text-sm">
            Ambiente de desenvolvimento profissional com múltiplas inteligências artificiais trabalhando em conjunto —
            editor real, terminal, agentes e todos os modelos gratuitos do OpenRouter.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button className="codnix-btn-primary" onClick={() => setCreateOpen(true)}>
              <Plus size={14} /> Criar projeto
            </button>
            {projects[0] && (
              <button className="codnix-btn-ghost" onClick={() => openProject(projects[0].id)}>
                <FolderOpen size={14} /> Continuar: {projects[0].name}
              </button>
            )}
          </div>
        </section>

        {/* Projetos */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">
            {showFavorites ? 'Projetos favoritos' : 'Projetos'}
          </h2>
          <div className="flex-1" />
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              className="codnix-input py-1.5 pl-8 text-xs md:w-64"
              placeholder="Pesquisar projeto..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button
            className={`codnix-btn-ghost text-xs ${showFavorites ? 'accent-border accent-text' : ''}`}
            onClick={() => setShowFavorites((f) => !f)}
            title="Favoritos"
          >
            <Star size={13} className={showFavorites ? 'fill-warn text-warn' : ''} /> Favoritos
          </button>
        </div>

        {loading ? (
          <p className="py-10 text-center text-xs text-ink-3">Carregando projetos...</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-edge p-10 text-center">
            <p className="text-sm text-ink-2">Nenhum projeto encontrado.</p>
            <button className="codnix-btn-primary mt-3" onClick={() => setCreateOpen(true)}>
              <Plus size={14} /> Criar o primeiro projeto
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => {
              const Icon = TEMPLATE_ICONS[p.template] || LayoutTemplate;
              return (
                <div key={p.id} className="group rounded-lg border border-edge bg-panel p-4 transition-colors hover:border-edge-strong">
                  <div className="flex items-start gap-3">
                    <button onClick={() => openProject(p.id)} className="flex min-w-0 flex-1 flex-col items-start text-left">
                      <span className="flex items-center gap-2 text-sm font-medium text-ink">
                        <span className="rounded-md accent-soft-bg p-1.5"><Icon size={15} /></span>
                        {p.name}
                      </span>
                      <span className="mt-1 line-clamp-2 text-2xs text-ink-2">{p.description}</span>
                      <span className="mt-2 text-2xs text-ink-3">
                        {p.fileCount} arquivos · atualizado {timeAgo(p.updated_at)}
                      </span>
                      {p.modelsUsed && p.modelsUsed.length > 0 && (
                        <span className="mt-1.5 flex flex-wrap gap-1">
                          {p.modelsUsed.slice(-3).map((m) => (
                            <span key={m} className="flex items-center gap-1 rounded-full border border-edge px-1.5 py-0.5 text-2xs text-ink-3">
                              <span className="h-1.5 w-1.5 rounded-full" style={{ background: providerColor(m.split('/')[0]) }} />
                              {m.split('/').pop()}
                            </span>
                          ))}
                        </span>
                      )}
                    </button>
                    <div className="flex flex-col gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => void toggleFavorite(p)}
                        className="rounded p-1 text-ink-3 hover:text-warn"
                        title={p.favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                      >
                        <Star size={13} className={p.favorite ? 'fill-warn text-warn' : ''} />
                      </button>
                      <button onClick={() => void removeProject(p)} className="rounded p-1 text-ink-3 hover:text-err" title="Excluir projeto">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Historico de uso */}
        {projects.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold"><History size={14} className="text-ink-3" /> Histórico</h2>
            <div className="overflow-hidden rounded-lg border border-edge">
              {projects.slice(0, 6).map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => openProject(p.id)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-xs hover:bg-panel-2 ${i > 0 ? 'border-t border-edge' : ''}`}
                >
                  <FolderOpen size={13} className="text-ink-3" />
                  <span className="flex-1 truncate text-ink-2">{p.name}</span>
                  <span className="text-2xs text-ink-3">{p.template} · {timeAgo(p.updated_at)}</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      <MobileNav />
      <ToastHost />

      {/* Criar projeto */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Criar novo projeto" width={560}>
        <label className="mb-1 block text-xs text-ink-2">Nome do projeto</label>
        <input
          className="codnix-input mb-3"
          placeholder="MeuProjeto"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void createProject()}
        />
        <label className="mb-1 block text-xs text-ink-2">Descrição (opcional)</label>
        <input className="codnix-input mb-3" placeholder="O que este projeto faz?" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
        <label className="mb-2 block text-xs text-ink-2">Template</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TEMPLATES.map((t) => {
            const Icon = TEMPLATE_ICONS[t.id] || LayoutTemplate;
            return (
              <button
                key={t.id}
                onClick={() => setNewTemplate(t.id)}
                className={`flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-colors ${
                  newTemplate === t.id ? 'accent-border accent-soft-bg' : 'border-edge bg-panel-2 hover:border-edge-strong'
                }`}
              >
                <Icon size={18} />
                <span className="text-xs font-medium">{t.name}</span>
                <span className="line-clamp-2 text-2xs text-ink-3">{t.description}</span>
              </button>
            );
          })}
        </div>
        <button className="codnix-btn-primary mt-4 w-full justify-center" onClick={() => void createProject()}>
          <Plus size={14} /> Criar projeto
        </button>
      </Modal>
    </div>
  );
}
