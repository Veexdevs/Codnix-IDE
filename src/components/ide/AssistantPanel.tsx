'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp, Bot, Code2, Cpu, FilePlus2, FolderOpen, GitBranch, Layers, Scale,
  Search, Settings2, Square, Users, Wrench, Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Logo from '@/components/shared/Logo';
import Markdown from '@/components/chat/Markdown';
import ModelPicker from '@/components/chat/ModelPicker';
import ContextPicker from './ContextPicker';
import ProposedChanges from './DiffView';
import { useApp } from '@/store/useAppStore';
import { useChat } from '@/store/useChatStore';
import { useSettings } from '@/store/useSettingsStore';
import { apiJson } from '@/lib/api-client';
import { providerColor, providerLabel } from '@/lib/model-utils';
import type { ChatMode, ProposedChange } from '@/types';

type AssistTab = 'assistente' | 'modelos' | 'agentes';

const MODES: { id: ChatMode; label: string; icon: LucideIcon; desc: string }[] = [
  { id: 'individual', label: 'Individual', icon: Bot, desc: 'Uma IA, conversa normal' },
  { id: 'team', label: 'Equipe', icon: Users, desc: 'Várias IAs em pipeline com consolidador' },
  { id: 'comparison', label: 'Comparação', icon: Scale, desc: 'Mesma pergunta para vários modelos' },
  { id: 'developer', label: 'Desenvolvedor', icon: Code2, desc: 'IA cria/edita arquivos com diff' },
  { id: 'review', label: 'Revisão', icon: GitBranch, desc: 'Uma IA escreve, outras revisam' },
];

const SUGGESTIONS = ['Corrigir este código', 'Explicar este código', 'Adicionar um sistema de login', 'Criar um novo arquivo', 'Escrever testes', 'Otimizar o projeto'];

export default function AssistantPanel({ compact = false }: { compact?: boolean }) {
  const [tab, setTab] = useState<AssistTab>('assistente');
  const [mode, setMode] = useState<ChatMode>('individual');
  const [input, setInput] = useState('');
  const [contextOpen, setContextOpen] = useState(false);
  const [contextFiles, setContextFiles] = useState<string[]>([]);
  const [outline, setOutline] = useState<string | null>(null);
  const [reindexing, setReindexing] = useState(false);
  const [compareModels, setCompareModels] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<ProposedChange[]>([]);
  const [modelQuery, setModelQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { project, projectId, files, addConsole, runCommand, createFile, deleteFile, saveFile } = useApp();
  const chat = useChat();
  const settings = useSettings();

  const conv = chat.activeConversation();
  const model = conv?.model || settings.defaultModel || chat.models[0]?.id || '';
  const streaming = chat.streaming;

  useEffect(() => {
    if (chat.models.length === 0) void chat.loadModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [conv?.messages.map((m) => m.content.length).join(','), conv?.messages.length]);

  const featured = useMemo(() => chat.models.filter((m) => m.featured).slice(0, 8), [chat.models]);

  const projectOutline = useMemo(() => project?.metadata?.index?.outline || null, [project]);

  const reindex = async () => {
    if (!projectId) return;
    setReindexing(true);
    try {
      const r = await apiJson<{ index: { outline: string } }>(`/api/projects/${projectId}/index`, { method: 'POST' });
      setOutline(r.index.outline);
      addConsole('Projeto indexado para contexto de IA.', 'ok');
    } catch {
      addConsole('Falha ao indexar projeto.', 'err');
    }
    setReindexing(false);
  };

  const buildOpts = () => ({
    projectOutline: outline || projectOutline || undefined,
    projectName: project?.name,
    contextFiles: contextFiles
      .map((p) => ({ path: p, content: files[p] || '' }))
      .filter((f) => f.content !== ''),
    files,
  });

  const send = async () => {
    const text = input.trim();
    if (!text || streaming || !model) return;
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';

    const opts = buildOpts();
    addConsole(`[IA] Modo ${mode} · modelo: ${model.split('/').pop()}`, 'info');

    if (mode === 'individual') {
      await chat.sendIndividual(text, opts);
    } else if (mode === 'team') {
      await chat.sendTeam(text, settings.agents, opts);
    } else if (mode === 'comparison') {
      const models = compareModels.length >= 2 ? compareModels : featured.slice(0, 3).map((m) => m.id);
      if (models.length < 2) {
        addConsole('Selecione ao menos 2 modelos para comparação.', 'err');
        return;
      }
      await chat.sendComparison(text, models, opts);
    } else if (mode === 'developer') {
      const changes = await chat.sendDeveloper(text, opts);
      setPendingChanges(changes || []);
    } else if (mode === 'review') {
      const reviewers = settings.agents.map((a) => a.model).filter((m) => m && m !== model);
      await chat.sendReview(text, model, reviewers.slice(0, 3), opts);
    }
  };

  const applyChange = async (change: ProposedChange) => {
    const a = change.action;
    try {
      if (a.type === 'create_file' && a.path) {
        await createFile(a.path, a.content || '');
        await saveFile(a.path);
      } else if (a.type === 'edit_file' && a.path) {
        await createFile(a.path, change.after ?? '');
        await saveFile(a.path);
      } else if (a.type === 'delete_file' && a.path) {
        await deleteFile(a.path);
      }
      change.status = 'applied';
      setPendingChanges((prev) => [...prev]);
      addConsole(`Alteração aplicada: ${a.path}`, 'ok');
    } catch (e) {
      change.status = 'error';
      change.error = (e as Error).message;
      setPendingChanges((prev) => [...prev]);
    }
  };

  const applyAll = async (changes: ProposedChange[]) => {
    for (const c of changes) {
      if (c.status === 'pending') await applyChange(c);
    }
    addConsole(`Todas as alterações aplicadas (${changes.length}).`, 'ok');
  };

  // ===== Aba Modelos =====
  const filteredModels = useMemo(() => {
    const q = modelQuery.toLowerCase().trim();
    return chat.models.filter((m) => !q || m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q) || m.provider.includes(q));
  }, [chat.models, modelQuery]);

  // ===== Aba Agentes =====
  return (
    <div className="flex h-full flex-col">
      {/* Header com abas */}
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-edge bg-panel px-2">
        <button
          className={`flex items-center gap-1 rounded px-2 py-1 text-2xs font-medium ${tab === 'assistente' ? 'accent-text' : 'text-ink-3 hover:text-ink'}`}
          onClick={() => setTab('assistente')}
        >
          <Zap size={12} /> Assistant
        </button>
        <button
          className={`flex items-center gap-1 rounded px-2 py-1 text-2xs font-medium ${tab === 'modelos' ? 'accent-text' : 'text-ink-3 hover:text-ink'}`}
          onClick={() => setTab('modelos')}
        >
          <Layers size={12} /> Modelos
        </button>
        <button
          className={`flex items-center gap-1 rounded px-2 py-1 text-2xs font-medium ${tab === 'agentes' ? 'accent-text' : 'text-ink-3 hover:text-ink'}`}
          onClick={() => setTab('agentes')}
        >
          <Users size={12} /> Agentes
        </button>
        <div className="flex-1" />
        <a href="/settings" className="rounded p-1 text-ink-3 hover:text-ink" title="Configurações">
          <Settings2 size={13} />
        </a>
      </div>

      {tab === 'assistente' && (
        <>
          {/* Splash / boas-vindas */}
          {(!conv || conv.messages.length === 0) && (
            <div className="flex flex-col items-center gap-3 px-4 pb-2 pt-6 text-center">
              <Logo size={44} />
              <p className="text-sm font-semibold">CODNIX ASSISTANT</p>
              <p className="text-2xs text-ink-2">Multiple Models. One Development Environment.</p>
              <button className="codnix-btn-ghost text-2xs" onClick={() => setContextOpen(true)} disabled={!projectId}>
                <FolderOpen size={12} /> Contexto do projeto {contextFiles.length > 0 && `(${contextFiles.length})`}
              </button>
              <div className="w-full rounded-lg border border-edge bg-panel-2 p-2.5 text-left">
                <p className="mb-1.5 flex items-center gap-1 text-2xs font-semibold text-ink-2">
                  <Cpu size={12} className="accent-text" /> Modelos Disponíveis
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {featured.slice(0, 4).map((m) => (
                    <button
                      key={m.id}
                      className="codnix-chip"
                      onClick={() => {
                        if (conv) chat.setConversationModel(conv.id, m.id);
                        settings.set('defaultModel', m.id);
                      }}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: providerColor(m.provider) }} />
                      {providerLabel(m.provider).split(' ')[0]} · {m.name.split(' ').slice(0, 2).join(' ')}
                    </button>
                  ))}
                  {featured.length === 0 && <span className="text-2xs text-ink-3">Carregando modelos do OpenRouter...</span>}
                </div>
              </div>
              <div className="w-full space-y-1">
                {SUGGESTIONS.slice(0, 4).map((s) => (
                  <button
                    key={s}
                    className="flex w-full items-center justify-between rounded-md border border-edge bg-panel-2 px-3 py-2 text-left text-xs text-ink-2 hover:border-edge-strong hover:text-ink"
                    onClick={() => {
                      setInput(s + (project ? ` no projeto ${project.name}` : ''));
                      inputRef.current?.focus();
                    }}
                  >
                    {s} <span className="text-ink-3">›</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Modo */}
          <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-edge px-2 py-1.5">
            <select className="codnix-select" value={mode} onChange={(e) => setMode(e.target.value as ChatMode)} title={MODES.find((m) => m.id === mode)?.desc}>
              {MODES.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            <ModelPicker value={model} onChange={(m) => conv && chat.setConversationModel(conv.id, m)} compact />
            <button className="codnix-chip" onClick={() => setContextOpen(true)} title="Selecionar arquivos de contexto">
              <FolderOpen size={11} /> Contexto {contextFiles.length > 0 && `(${contextFiles.length})`}
            </button>
            {mode === 'comparison' && (
              <button className={`codnix-chip ${compareModels.length >= 2 ? 'accent-border' : ''}`} onClick={() => setCompareOpen(true)}>
                <Scale size={11} /> {compareModels.length || 3} modelos
              </button>
            )}
          </div>

          {/* Mensagens */}
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            {conv?.messages.map((m) => (
              <div key={m.id} className={m.role === 'user' ? 'mb-2' : 'mb-3'}>
                {m.role === 'user' ? (
                  <div className="rounded-lg border border-edge bg-panel-2 px-3 py-2 text-xs text-ink whitespace-pre-wrap">{m.content}</div>
                ) : (
                  <div>
                    <div className="mb-1 flex items-center gap-1.5">
                      {m.agentLabel ? (
                        <span className="rounded accent-soft-bg px-1.5 py-0.5 text-2xs font-medium accent-text">{m.agentLabel}</span>
                      ) : (
                        <span className="flex items-center gap-1 text-2xs text-ink-3">
                          <Bot size={11} /> Codnix Assistant
                        </span>
                      )}
                      {m.model && <span className="text-2xs text-ink-3">· {m.model.split('/').pop()}</span>}
                    </div>
                    {m.error ? (
                      <div className="rounded-md border border-err/40 bg-err/10 px-2 py-1.5 text-2xs text-err">{m.error}</div>
                    ) : (
                      <Markdown content={m.content || (m.streaming ? '' : '_sem resposta_')} streaming={m.streaming} onSendToProject={(code, lang) => {
                        const path = prompt(`Caminho do arquivo (.${lang || 'txt'}):`, `src/novo-arquivo.${lang || 'js'}`);
                        if (path) void createFile(path, code);
                      }} />
                    )}
                  </div>
                )}
              </div>
            ))}
            {pendingChanges.length > 0 && (
              <ProposedChanges
                changes={pendingChanges}
                onApply={applyChange}
                onApplyAll={applyAll}
                onRunCommand={async (cmd) => {
                  await runCommand(cmd);
                }}
              />
            )}
            {chat.generationState && (
              <p className="flex items-center gap-2 px-1 py-1 text-2xs text-ink-3">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full accent-bg" />
                {chat.team.running ? `Equipe: ${chat.team.currentStep} (${chat.team.requestsUsed} req.)` : `Gerando com ${chat.generationState.label}...`}
              </p>
            )}
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-edge p-2">
            <div className="flex items-end gap-1.5 rounded-lg border border-edge bg-panel-2 px-2 py-1.5 focus-within:border-edge-strong">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={1}
                placeholder={`Pergunte ou peça código (${MODES.find((m) => m.id === mode)?.label})...`}
                className="max-h-30 flex-1 resize-none bg-transparent py-1 text-xs text-ink outline-none placeholder:text-ink-3"
              />
              {streaming ? (
                <button className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-edge text-ink" onClick={chat.cancel} title="Parar">
                  <Square size={12} />
                </button>
              ) : (
                <button
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white disabled:opacity-40"
                  style={{ background: 'var(--accent)' }}
                  onClick={() => void send()}
                  disabled={!input.trim() || !model}
                  title="Enviar"
                >
                  <ArrowUp size={14} />
                </button>
              )}
            </div>
            {!model && <p className="mt-1 text-2xs text-warn">Selecione um modelo para começar.</p>}
          </div>
        </>
      )}

      {tab === 'modelos' && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-edge px-2 py-1.5">
            <Search size={12} className="text-ink-3" />
            <input className="w-full bg-transparent text-xs outline-none placeholder:text-ink-3" placeholder="Pesquisar modelos gratuitos..." value={modelQuery} onChange={(e) => setModelQuery(e.target.value)} />
            <button className="text-ink-3 hover:text-ink" onClick={() => void chat.loadModels(true)} title="Atualizar">
              <Zap size={12} className={chat.modelsLoading ? 'animate-pulse' : ''} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {chat.modelsError && <p className="p-2 text-2xs text-err">{chat.modelsError}</p>}
            {filteredModels.map((m) => (
              <button
                key={m.id}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-panel-2 ${model === m.id ? 'bg-accent-soft' : ''}`}
                onClick={() => {
                  settings.set('defaultModel', m.id);
                  if (conv) chat.setConversationModel(conv.id, m.id);
                }}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: providerColor(m.provider) }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs text-ink">{m.name}</span>
                  <span className="block truncate text-2xs text-ink-3">{m.id} · {providerLabel(m.provider)}</span>
                </span>
                {model === m.id && <span className="shrink-0 text-2xs accent-text">em uso</span>}
              </button>
            ))}
            {!chat.modelsLoading && filteredModels.length === 0 && !chat.modelsError && (
              <p className="p-4 text-center text-2xs text-ink-3">Nenhum modelo. Verifique conexão.</p>
            )}
          </div>
          <p className="border-t border-edge px-2 py-1 text-2xs text-ink-3">
            {chat.models.length} modelos gratuitos · atualize com o botão ⚡
          </p>
        </div>
      )}

      {tab === 'agentes' && (
        <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
          <p className="mb-2 text-2xs leading-relaxed text-ink-2">
            Configure a equipe para o <strong>Modo Equipe</strong>: cada agente recebe uma etapa da tarefa e o
            consolidador integra tudo. Os modelos são dos gratuitos do OpenRouter.
          </p>
          <div className="flex flex-col gap-1.5">
            {settings.agents.map((a) => (
              <div key={a.id} className="rounded-md border border-edge bg-panel-2 p-2">
                <div className="mb-1 flex items-center gap-1.5">
                  <Wrench size={11} className="text-ink-3" />
                  <input
                    className="w-24 bg-transparent text-xs font-medium text-ink outline-none"
                    value={a.role}
                    onChange={(e) => settings.updateAgent(a.id, { role: e.target.value })}
                  />
                  <div className="flex-1" />
                  <button className="text-2xs text-ink-3 hover:text-err" onClick={() => settings.removeAgent(a.id)}>
                    remover
                  </button>
                </div>
                <select
                  className="codnix-select w-full text-2xs"
                  value={a.model}
                  onChange={(e) => settings.updateAgent(a.id, { model: e.target.value })}
                >
                  <option value="">Selecionar modelo gratuito...</option>
                  {chat.models.map((m) => (
                    <option key={m.id} value={m.id}>{providerLabel(m.provider)} · {m.name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <button className="codnix-btn-ghost mt-2 w-full justify-center text-2xs" onClick={settings.addAgent}>
            <FilePlus2 size={11} /> Adicionar agente
          </button>
          <div className="mt-2 rounded-md border border-edge bg-panel-2 p-2">
            <label className="mb-1 block text-2xs text-ink-2">Consolidador final</label>
            <select className="codnix-select w-full text-2xs" value={settings.teamConsolidator} onChange={(e) => settings.set('teamConsolidator', e.target.value)}>
              <option value="">Automático (primeiro agente)</option>
              {chat.models.map((m) => (
                <option key={m.id} value={m.id}>{providerLabel(m.provider)} · {m.name}</option>
              ))}
            </select>
            <label className="mt-2 block text-2xs text-ink-2">Orçamento de requisições: {settings.maxRequests}</label>
            <input
              type="range"
              min={2}
              max={20}
              value={settings.maxRequests}
              onChange={(e) => settings.set('maxRequests', Number(e.target.value))}
              className="w-full accent-[var(--accent)]"
            />
          </div>
        </div>
      )}

      {/* Comparacao: selecao de modelos */}
      {compareOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onMouseDown={() => setCompareOpen(false)}>
          <div className="max-h-[70vh] w-full max-w-sm overflow-hidden rounded-lg border border-edge bg-panel" onMouseDown={(e) => e.stopPropagation()}>
            <p className="border-b border-edge px-3 py-2 text-xs font-semibold">Modelos para comparação (2+)</p>
            <div className="max-h-80 overflow-y-auto p-1.5">
              {chat.models.map((m) => (
                <button
                  key={m.id}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-panel-2"
                  onClick={() =>
                    setCompareModels((prev) => (prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id].slice(0, 4)))
                  }
                >
                  <span className={`flex h-3.5 w-3.5 items-center justify-center rounded border ${compareModels.includes(m.id) ? 'accent-border accent-soft-bg' : 'border-edge-strong'}`}>
                    {compareModels.includes(m.id) && <span className="h-1.5 w-1.5 rounded-full accent-bg" />}
                  </span>
                  <span className="h-2 w-2 rounded-full" style={{ background: providerColor(m.provider) }} />
                  <span className="min-w-0 flex-1 truncate text-ink-2">{m.name}</span>
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2 border-t border-edge p-2">
              <button className="codnix-btn-ghost text-2xs" onClick={() => setCompareModels([])}>Limpar</button>
              <button className="codnix-btn-primary text-2xs" onClick={() => setCompareOpen(false)}>
                Confirmar ({compareModels.length || 'padrão: 3'})
              </button>
            </div>
          </div>
        </div>
      )}

      <ContextPicker
        open={contextOpen}
        onClose={() => setContextOpen(false)}
        selected={contextFiles}
        onChange={setContextFiles}
        outline={outline || projectOutline}
        onReindex={() => void reindex()}
        reindexing={reindexing}
      />
    </div>
  );
}
