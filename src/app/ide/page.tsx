'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Bot, Code2, Download, FileText, GitBranch, HelpCircle, Info, Layers,
  Menu, Play, PlayCircle, Puzzle, Search, Settings2, SquareTerminal, X, XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import Logo from '@/components/shared/Logo';
import Modal from '@/components/shared/Modal';
import { ToastHost, useToast } from '@/components/shared/Toast';
import { useApp } from '@/store/useAppStore';
import EditorPane from '@/components/ide/EditorPane';
import BottomPanel, { type BottomTab } from '@/components/ide/BottomPanel';
import AssistantPanel from '@/components/ide/AssistantPanel';
import StatusBar from '@/components/ide/StatusBar';
import QuickOpen from '@/components/ide/QuickOpen';
import { ExtensionsPanel, GitPanel, RunPanel, SearchPanel } from '@/components/ide/SidePanels';

const Explorer = dynamic(() => import('@/components/ide/Explorer'), { ssr: false });

type SidePanel = 'explorer' | 'search' | 'git' | 'run' | 'extensions';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
}

function useIsLandscapeMobile() {
  const [landscape, setLandscape] = useState(false);
  useEffect(() => {
    const check = () => setLandscape(window.innerWidth < 1024 && window.innerWidth > window.innerHeight);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return landscape;
}

export default function IdePage() {
  const router = useRouter();
  const toast = useToast((s) => s.show);
  const app = useApp();
  const isMobile = useIsMobile();
  const isLandscapeMobile = useIsLandscapeMobile();

  const [sidePanel, setSidePanel] = useState<SidePanel>('explorer');
  const [sideOpen, setSideOpen] = useState(true);
  const [assistOpen, setAssistOpen] = useState(true);
  const [bottomTab, setBottomTab] = useState<BottomTab>('terminal');
  const [bottomCollapsed, setBottomCollapsed] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  
  // carrega projeto salvo
  useEffect(() => {
    if (!app.projectId) {
      try {
        const saved = JSON.parse(localStorage.getItem('codnix-app') || '{}');
        const pid = saved?.state?.projectId as string | undefined;
        if (pid) void app.loadProject(pid);
      } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // atalhos globais
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void app.saveAllFiles();
        toast('Arquivos salvos', 'ok');
      }
      if (mod && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setQuickOpen(true);
      }
      if (mod && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setSideOpen((o) => !o);
      }
      if (mod && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setBottomCollapsed((c) => !c);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // fecha menus ao clicar fora
  useEffect(() => {
    const onClick = () => setMenu(null);
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const exportZip = async () => {
    if (!app.projectId) return;
    window.open(`/api/projects/${app.projectId}/export`, '_blank');
    app.addOutput('Exportação do projeto iniciada (.zip).', 'ok');
  };

  const runActiveFile = useCallback(async () => {
    const active = app.activeTab;
    if (!active) return;
    const lang = active.split('.').pop()?.toLowerCase();
    let cmd: string | null = null;
    if (lang === 'py') cmd = `python3 ${active}`;
    else if (lang === 'js' || lang === 'mjs') cmd = `node ${active}`;
    else if (lang === 'cpp' || lang === 'cc' || lang === 'cxx') cmd = 'mkdir -p bin && g++ -Iinclude src/*.cpp -o bin/app && ./bin/app';
    else if (lang === 'c') cmd = 'mkdir -p bin && gcc -Iinclude src/*.c -o bin/app && ./bin/app';
    else if (lang === 'php') cmd = `php ${active}`;
    else if (lang === 'lua') cmd = `lua ${active}`;
    else if (lang === 'html') {
      setBottomTab('preview');
      setBottomCollapsed(false);
      return;
    }
    if (!cmd) {
      toast(`Não há como executar .${lang} automaticamente — use o terminal.`, 'info');
      return;
    }
    setBottomTab('terminal');
    setBottomCollapsed(false);
    await app.runCommand(cmd);
  }, [app, toast]);

  const panelContent = useMemo(() => {
    switch (sidePanel) {
      case 'explorer':
        return <Explorer />;
      case 'search':
        return <SearchPanel />;
      case 'git':
        return <GitPanel />;
      case 'run':
        return <RunPanel />;
      case 'extensions':
        return <ExtensionsPanel />;
    }
  }, [sidePanel]);

  const ACTIVITY: { id: SidePanel; icon: LucideIcon; label: string }[] = [
    { id: 'explorer', icon: Code2, label: 'Explorer (Ctrl+B)' },
    { id: 'search', icon: Search, label: 'Buscar no projeto' },
    { id: 'git', icon: GitBranch, label: 'Alterações' },
    { id: 'run', icon: PlayCircle, label: 'Executar' },
    { id: 'extensions', icon: Puzzle, label: 'Extensões/Linguagens' },
  ];

  const MENUS: Record<string, { label: string; action: () => void }[]> = {
    Arquivo: [
      { label: 'Novo arquivo (Explorer)', action: () => { setSidePanel('explorer'); setSideOpen(true); } },
      { label: 'Salvar tudo (Ctrl+S)', action: () => { void app.saveAllFiles(); toast('Arquivos salvos', 'ok'); } },
      { label: 'Ir para arquivo (Ctrl+P)', action: () => setQuickOpen(true) },
      { label: 'Exportar projeto (.zip)', action: () => void exportZip() },
      { label: 'Voltar aos projetos', action: () => router.push('/') },
    ],
    Editar: [
      { label: 'Formatar documento', action: () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F', shiftKey: true, altKey: true })) },
      { label: 'Buscar no arquivo (Ctrl+F)', action: () => toast('Use Ctrl+F dentro do editor aberto', 'info') },
      { label: 'Substituir (Ctrl+H)', action: () => toast('Use Ctrl+H dentro do editor aberto', 'info') },
    ],
    Visualizar: [
      { label: 'Alternar Explorer (Ctrl+B)', action: () => setSideOpen((o) => !o) },
      { label: 'Alternar painel inferior (Ctrl+J)', action: () => setBottomCollapsed((c) => !c) },
      { label: 'Alternar Assistente', action: () => setAssistOpen((o) => !o) },
      { label: 'Configurações', action: () => router.push('/settings') },
    ],
    Executar: [
      { label: 'Executar arquivo ativo', action: () => void runActiveFile() },
      { label: 'Painel Executar', action: () => { setSidePanel('run'); setSideOpen(true); } },
      { label: 'Abrir terminal', action: () => { setBottomTab('terminal'); setBottomCollapsed(false); } },
    ],
    Terminal: [
      { label: 'Limpar terminal', action: () => app.clearTerminal() },
      { label: 'Nova sessão de terminal', action: () => { void app.disposeTerminal(); toast('Sessão encerrada — nova sessão será criada no próximo comando', 'ok'); } },
    ],
    Ajuda: [
      { label: 'Sobre o CODNIX IDE', action: () => setAboutOpen(true) },
      { label: 'Chat com IA', action: () => router.push('/chat') },
    ],
  };

  // ===================== LAYOUT DESKTOP =====================
  if (!isMobile) {
    return (
      <div className="flex h-dvh flex-col bg-base">
        {/* Titlebar */}
        <div className="flex h-9 shrink-0 items-center gap-1 border-b border-edge bg-panel px-2">
          <div className="flex items-center gap-2 pr-2">
            <Logo size={20} />
            <span className="text-2xs font-semibold tracking-widest text-ink">CODNIX IDE</span>
          </div>
          {Object.keys(MENUS).map((m) => (
            <div key={m} className="relative">
              <button
                className={`rounded px-2 py-1 text-xs ${menu === m ? 'bg-panel-3 text-ink' : 'text-ink-2 hover:text-ink'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenu(menu === m ? null : m);
                }}
              >
                {m}
              </button>
              {menu === m && (
                <div className="absolute left-0 top-full z-50 mt-1 min-w-[220px] rounded-md border border-edge bg-panel-3 py-1 shadow-xl" onClick={(e) => e.stopPropagation()}>
                  {MENUS[m].map((item) => (
                    <button
                      key={item.label}
                      className="block w-full px-3 py-1.5 text-left text-xs text-ink-2 hover:bg-panel-2 hover:text-ink"
                      onClick={() => {
                        setMenu(null);
                        item.action();
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div className="mx-auto flex w-[320px] items-center gap-1.5 rounded-md border border-edge bg-panel-2 px-2 py-1">
            <Search size={12} className="text-ink-3" />
            <input
              className="w-full bg-transparent text-xs outline-none placeholder:text-ink-3"
              placeholder="Pesquisar no projeto..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setSidePanel('search');
                  setSideOpen(true);
                  const q = (e.target as HTMLInputElement).value;
                  if (q) {
                    // dispara a busca do painel via evento customizado
                    window.dispatchEvent(new CustomEvent('codnix-search', { detail: q }));
                  }
                }
              }}
            />
          </div>
          <div className="flex-1" />
          <button className="codnix-btn-primary px-2 py-1 text-2xs" onClick={() => void runActiveFile()} title="Executar arquivo ativo">
            <Play size={12} /> Executar
          </button>
          <button className="rounded p-1.5 text-ink-2 hover:text-ink" title="Exportar .zip" onClick={() => void exportZip()}>
            <Download size={14} />
          </button>
          <button className="rounded p-1.5 text-ink-2 hover:text-ink" title="Sobre" onClick={() => setAboutOpen(true)}>
            <HelpCircle size={14} />
          </button>
        </div>

        {/* Corpo */}
        <div className="flex min-h-0 flex-1">
          {/* Activity bar */}
          <div className="flex w-11 shrink-0 flex-col items-center gap-1 border-r border-edge bg-panel py-2">
            {ACTIVITY.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                title={label}
                className={`rounded-md p-2 ${sidePanel === id && sideOpen ? 'accent-soft-bg accent-text' : 'text-ink-3 hover:text-ink'}`}
                onClick={() => {
                  if (sidePanel === id) setSideOpen((o) => !o);
                  else {
                    setSidePanel(id);
                    setSideOpen(true);
                  }
                }}
              >
                <Icon size={18} />
              </button>
            ))}
            <div className="flex-1" />
            <button
              className={`rounded-md p-2 ${assistOpen ? 'accent-soft-bg accent-text' : 'text-ink-3 hover:text-ink'}`}
              title="Codnix Assistant"
              onClick={() => setAssistOpen((o) => !o)}
            >
              <Bot size={18} />
            </button>
            <a className="rounded-md p-2 text-ink-3 hover:text-ink" href="/settings" title="Configurações">
              <Settings2 size={18} />
            </a>
          </div>

          {/* Side panel */}
          {sideOpen && (
            <div className="w-60 shrink-0 border-r border-edge bg-panel">{panelContent}</div>
          )}

          {/* Editor + bottom */}
          <div className="flex min-w-0 flex-1 flex-col">
            <EditorPane />
            <div className={bottomCollapsed ? 'h-8' : 'h-56'}>
              <BottomPanel tab={bottomTab} setTab={setBottomTab} collapsed={bottomCollapsed} setCollapsed={setBottomCollapsed} />
            </div>
          </div>

          {/* Assistant */}
          {assistOpen && (
            <div className="w-[340px] shrink-0 border-l border-edge bg-panel">
              <AssistantPanel />
            </div>
          )}
        </div>

        <StatusBar onOpenProblems={() => { setBottomTab('problemas'); setBottomCollapsed(false); }} />
        <QuickOpen open={quickOpen} onClose={() => setQuickOpen(false)} />
        <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
        <ToastHost />
      </div>
    );
  }

  // ===================== LAYOUT MOBILE =====================
  return (
    <div className="flex h-dvh flex-col bg-base">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center gap-1.5 border-b border-edge bg-panel px-2">
        <button className="text-ink-2 hover:text-ink" onClick={() => router.push('/')} title="Projetos">
          <ArrowLeft size={17} />
        </button>
        <Logo size={20} />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold tracking-wide">CODNIX IDE{app.project ? ` · ${app.project.name}` : ''}</span>
        <button className="rounded p-1.5 text-ink-2 hover:text-ink" title="Buscar no projeto" onClick={() => { setSidePanel('search'); setSideOpen(true); }}>
          <Search size={16} />
        </button>
        <button className="rounded p-1.5 text-ink-2 hover:text-ink" title="Assistente" onClick={() => setAssistOpen((o) => !o)}>
          <Bot size={16} className={assistOpen ? 'accent-text' : ''} />
        </button>
        <button className="flex h-8 w-8 items-center justify-center rounded-lg text-white" style={{ background: 'var(--accent)' }} onClick={() => void runActiveFile()} title="Executar">
          <Play size={15} />
        </button>
      </div>

      {/* Corpo */}
      <div className="flex min-h-0 flex-1">
        {/* Mini rail (retrato) */}
        <div className="flex w-12 shrink-0 flex-col items-center gap-0.5 border-r border-edge bg-panel py-1.5">
          {ACTIVITY.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              title={label}
              className={`flex flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-2xs ${sidePanel === id && sideOpen ? 'accent-soft-bg accent-text' : 'text-ink-3'}`}
              onClick={() => {
                if (sidePanel === id && sideOpen && sidePanel !== 'explorer') setSideOpen(false);
                else if (sidePanel === id) setSideOpen((o) => !o);
                else {
                  setSidePanel(id);
                  setSideOpen(true);
                }
              }}
            >
              <Icon size={17} />
            </button>
          ))}
          <div className="flex-1" />
          <a className="rounded-md p-1.5 text-ink-3" href="/settings" title="Configurações">
            <Settings2 size={17} />
          </a>
        </div>

        {/* Painel lateral / Editor */}
        <div className="flex min-w-0 flex-1 flex-col">
          {sideOpen && sidePanel !== 'explorer' && !isLandscapeMobile ? (
            <div className="min-h-0 flex-1 bg-panel">{panelContent}</div>
          ) : (
            <EditorColumn />
          )}

          {/* Assistente como bottom-sheet (retrato) */}
          {assistOpen && !isLandscapeMobile && (
            <div className="h-[46%] min-h-[220px] border-t border-edge bg-panel">
              <div className="flex items-center justify-between border-b border-edge px-2 py-1">
                <span className="text-2xs font-semibold text-ink-2">Codnix Assistant</span>
                <button className="text-ink-3 hover:text-ink" onClick={() => setAssistOpen(false)}><X size={13} /></button>
              </div>
              <div className="min-h-0 flex-1">
                <AssistantPanel compact />
              </div>
            </div>
          )}

          {/* Painel inferior (terminal) — quando assistente fechado */}
          {!assistOpen && (
            <div className={bottomCollapsed ? 'h-9' : 'h-44'}>
              <BottomPanel tab={bottomTab} setTab={setBottomTab} collapsed={bottomCollapsed} setCollapsed={setBottomCollapsed} />
            </div>
          )}
        </div>

        {/* Assistente lateral no modo paisagem (referencia mobile paisagem) */}
        {assistOpen && isLandscapeMobile && (
          <div className="w-[38%] min-w-[260px] shrink-0 border-l border-edge bg-panel">
            <AssistantPanel compact />
          </div>
        )}
      </div>

      {/* Barra inferior mobile: Terminal | Problemas | Saída | Executar (referência mobile) */}
      <div className="flex h-12 shrink-0 items-stretch border-t border-edge bg-panel md:hidden">
        <button
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-2xs ${!assistOpen && bottomTab === 'terminal' && !bottomCollapsed ? 'accent-text' : 'text-ink-3'}`}
          onClick={() => {
            setAssistOpen(false);
            setBottomTab('terminal');
            setBottomCollapsed(false);
          }}
        >
          <SquareTerminal size={17} /> Terminal
        </button>
        <button
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-2xs ${bottomTab === 'problemas' && !bottomCollapsed && !assistOpen ? 'accent-text' : 'text-ink-3'}`}
          onClick={() => {
            setAssistOpen(false);
            setBottomTab('problemas');
            setBottomCollapsed(false);
          }}
        >
          <AlertsBadge /> Problemas
        </button>
        <button
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-2xs ${bottomTab === 'saida' && !bottomCollapsed && !assistOpen ? 'accent-text' : 'text-ink-3'}`}
          onClick={() => {
            setAssistOpen(false);
            setBottomTab('saida');
            setBottomCollapsed(false);
          }}
        >
          <Menu size={17} /> Saída
        </button>
        <button
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-2xs ${assistOpen ? 'accent-text' : 'text-ink-3'}`}
          onClick={() => {
            setAssistOpen(true);
          }}
        >
          <Bot size={17} /> Assistant
        </button>
      </div>

      <StatusBar onOpenProblems={() => { setBottomTab('problemas'); setBottomCollapsed(false); setAssistOpen(false); }} />
      <QuickOpen open={quickOpen} onClose={() => setQuickOpen(false)} />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <ToastHost />
    </div>
  );
}

function EditorColumn() {
  const app = useApp();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Abas de arquivo */}
      <div className="flex h-8 shrink-0 items-center overflow-x-auto border-b border-edge bg-panel px-1">
        {app.openTabs.map((t) => (
          <button
            key={t}
            className={`flex h-full items-center gap-1 border-b-2 px-2.5 text-xs ${app.activeTab === t ? 'border-accent text-ink' : 'border-transparent text-ink-2'}`}
            onClick={() => app.setActiveTab(t)}
          >
            <FileText size={11} /> {t.split('/').pop()}
            <span
              onClick={(e) => {
                e.stopPropagation();
                app.closeTab(t);
              }}
            >
              <X size={11} className="text-ink-3" />
            </span>
          </button>
        ))}
        {app.openTabs.length === 0 && <span className="px-2 text-2xs text-ink-3">Sem abas — abra pelo Explorer</span>}
        <div className="flex-1" />
        <button className="px-2 text-2xs text-ink-3 hover:text-ink" onClick={() => { void useApp.getState().openFile('README.md'); }}>Explorer ›</button>
      </div>
      <EditorPane />
    </div>
  );
}

function AlertsBadge() {
  const errors = useApp((s) => s.markers.filter((m) => m.severity === 'error').length);
  return (
    <span className="relative">
      <XCircle size={17} />
      {errors > 0 && (
        <span className="absolute -right-2 -top-1 rounded-full bg-err px-1 text-[9px] font-bold text-white">{errors}</span>
      )}
    </span>
  );
}

function AboutModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Sobre o CODNIX IDE" width={400}>
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo size={56} />
        <p className="text-sm font-semibold">CODNIX IDE v1.0.0</p>
        <p className="text-xs text-ink-2">Multiple Models. One Development Environment.</p>
        <div className="mt-1 w-full space-y-1.5 text-left text-2xs text-ink-2">
          <p>• Multi-IA real via OpenRouter (somente modelos gratuitos)</p>
          <p>• Editor Monaco, terminal real com segurança, Explorer completo</p>
          <p>• Modos: Individual, Equipe, Comparação, Desenvolvedor e Revisão</p>
          <p>• Web (Vercel), Android, Windows e iOS via GitHub Actions</p>
        </div>
        <a href="https://github.com/Veexdevs/Codnix-IDE" target="_blank" rel="noreferrer" className="codnix-btn-ghost text-xs">
          <Layers size={13} /> Repositório
        </a>
      </div>
    </Modal>
  );
}
