'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUp, ChevronLeft, FileText, MessageSquarePlus, MoreVertical, Paperclip,
  Pencil, Send, Square, Trash2, X,
} from 'lucide-react';
import Logo from '@/components/shared/Logo';
import Markdown from '@/components/chat/Markdown';
import ModelPicker from '@/components/chat/ModelPicker';
import MobileNav from '@/components/shared/MobileNav';
import Modal from '@/components/shared/Modal';
import { ToastHost, useToast } from '@/components/shared/Toast';
import { useChat } from '@/store/useChatStore';
import { useApp } from '@/store/useAppStore';
import { useSettings } from '@/store/useSettingsStore';
import { apiJson } from '@/lib/api-client';
import type { ChatMessage } from '@/types';

function MessageBubble({ msg, onSendToProject }: { msg: ChatMessage; onSendToProject: (code: string, lang: string) => void }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end px-4 py-1.5">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-panel-3 px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
          {msg.content}
          {msg.attachments?.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {msg.attachments.map((a) => (
                <span key={a.path} className="codnix-chip text-2xs">
                  <FileText size={11} /> {a.name}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    );
  }
  return (
    <div className="px-4 py-1.5">
      <div className="mb-1 flex items-center gap-2">
        {msg.agentLabel ? (
          <span className="rounded bg-accent-soft px-1.5 py-0.5 text-2xs font-medium accent-text">{msg.agentLabel}</span>
        ) : (
          <span className="text-2xs font-medium text-ink-3">Codnix Assistant</span>
        )}
        {msg.model && <span className="text-2xs text-ink-3">· {msg.model}</span>}
      </div>
      {msg.error ? (
        <div className="rounded-lg border border-err/40 bg-err/10 px-3 py-2 text-xs text-err">{msg.error}</div>
      ) : (
        <div className="text-ink">
          <Markdown content={msg.content || (msg.streaming ? '' : '_(resposta vazia)_')} streaming={msg.streaming} onSendToProject={onSendToProject} />
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  const {
    conversations, activeId, loaded, loadConversations, newConversation, deleteConversation,
    renameConversation, setActive, activeConversation, sendIndividual, cancel, streaming,
    generationState, loadModels, models,
  } = useChat();
  const { projectId, project, loadProject, files } = useApp();
  const { defaultModel, set } = useSettings();
  const toast = useToast((s) => s.show);

  const [input, setInput] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<{ path: string; name: string; content: string }[]>([]);
  const [drawer, setDrawer] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState<{ code: string; lang: string } | null>(null);
  const [sendPath, setSendPath] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void loadModels();
    void loadConversations();
    // projeto atual: carrega o salvo ou o mais recente
    const saved = localStorage.getItem('codnix-app');
    let pid: string | null = null;
    try {
      pid = (JSON.parse(saved || '{}')?.state?.projectId as string) || null;
    } catch { /* ignore */ }
    if (!pid) {
      void apiJson<{ projects: { id: string }[] }>('/api/projects')
        .then((r) => {
          if (r.projects?.[0]) void loadProject(r.projects[0].id);
        })
        .catch(() => {});
    } else if (pid) {
      void loadProject(pid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const conv = activeConversation();
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [conv?.messages.length, conv?.messages[conv.messages.length - 1]?.content]);

  const model = conv?.model || defaultModel || models[0]?.id || '';

  const send = useCallback(() => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    const attachments = pendingAttachments;
    setPendingAttachments([]);
    void sendIndividual(text, {
      contextFiles: [],
      projectName: project?.name,
      attachments,
    });
  }, [input, streaming, sendIndividual, project, pendingAttachments]);

  const fileTree = useMemo(() => Object.keys(files).sort(), [files]);

  const doSendToProject = async () => {
    if (!sendOpen) return;
    let path = sendPath.trim();
    if (!path) {
      toast('Informe o caminho do arquivo', 'err');
      return;
    }
    if (!path.includes('.')) path += `.${sendOpen.lang || 'txt'}`;
    const ok = await useApp.getState().createFile(path, sendOpen.code);
    if (ok) {
      toast(`Código enviado para ${path}`, 'ok');
      setSendOpen(null);
      setSendPath('');
    } else {
      toast('Falha ao criar arquivo', 'err');
    }
  };

  const attachFile = (path: string) => {
    const content = files[path] || '';
    setPendingAttachments((prev) => [...prev, { path, name: path, content }]);
    setAttachOpen(false);
    toast(`Arquivo anexado: ${path}`, 'ok');
    textareaRef.current?.focus();
  };

  return (
    <div className="flex h-dvh flex-col bg-base">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-edge px-3 md:h-14 md:px-4">
        <button className="text-ink-2 hover:text-ink md:hidden" onClick={() => setDrawer(true)} title="Histórico">
          <ChevronLeft size={18} />
        </button>
        <Logo size={22} />
        <div className="ml-1 min-w-0 flex-1 truncate text-xs text-ink-2">{conv?.title || 'CODNIX Chat'}</div>
        <ModelPicker value={model} onChange={(m) => conv && useChat.getState().setConversationModel(conv.id, m)} align="right" />
        <button
          onClick={() => {
            const c = newConversation(model, 'individual', projectId || undefined);
            setDrawer(false);
            void c;
          }}
          className="rounded-md p-1.5 text-ink-2 hover:bg-panel-2 hover:text-ink"
          title="Nova conversa"
        >
          <MessageSquarePlus size={17} />
        </button>
      </header>

      {/* Mensagens */}
      <main className="min-h-0 flex-1 overflow-y-auto py-3">
        {!conv || conv.messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <Logo size={56} />
            <h1 className="text-lg font-semibold">Como posso ajudar no seu projeto hoje?</h1>
            <p className="max-w-sm text-xs text-ink-2">
              Converse com qualquer modelo gratuito do OpenRouter. Envie código, peça explicações, correções ou
              implementações no seu projeto.
            </p>
            <div className="grid w-full max-w-sm grid-cols-2 gap-2">
              {['Explicar código', 'Corrigir erros', 'Gerar código', 'Otimizar'].map((s) => (
                <button key={s} className="codnix-btn-ghost justify-center text-xs" onClick={() => setInput(`Me ajude a ${s.toLowerCase()} no meu projeto.`)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-1 pb-4">
            {conv.messages.map((m) => (
              <MessageBubble key={m.id} msg={m} onSendToProject={(code, lang) => { setSendOpen({ code, lang }); setSendPath(''); }} />
            ))}
            {generationState && (
              <div className="flex items-center gap-2 px-4 py-1 text-2xs text-ink-3">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full accent-bg" />
                Gerando com {generationState.label}...
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </main>

      {/* Input fixo */}
      <div className="shrink-0 border-t border-edge bg-panel px-3 pb-2 pt-2 md:px-4">
        <div className="mx-auto max-w-3xl">
          {pendingAttachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {pendingAttachments.map((a) => (
                <span key={a.path} className="codnix-chip">
                  <FileText size={11} /> {a.name}
                  <button onClick={() => setPendingAttachments((prev) => prev.filter((p) => p.path !== a.path))}>
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 rounded-2xl border border-edge bg-panel-2 px-3 py-2 focus-within:border-edge-strong">
            <button
              onClick={() => setAttachOpen(true)}
              className="mb-1 rounded p-1 text-ink-3 hover:text-ink"
              title="Anexar arquivo do projeto"
            >
              <Paperclip size={17} />
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder="Digite sua pergunta ou pedido..."
              className="max-h-40 flex-1 resize-none bg-transparent py-1.5 text-sm text-ink outline-none placeholder:text-ink-3"
            />
            {streaming ? (
              <button onClick={cancel} className="mb-0.5 flex h-8 w-8 items-center justify-center rounded-lg border border-edge bg-panel-3 text-ink" title="Parar geração">
                <Square size={14} />
              </button>
            ) : (
              <button
                onClick={send}
                disabled={!input.trim()}
                className="mb-0.5 flex h-8 w-8 items-center justify-center rounded-lg text-white disabled:opacity-40"
                style={{ background: 'var(--accent)' }}
                title="Enviar"
              >
                <ArrowUp size={16} />
              </button>
            )}
          </div>
          <p className="mt-1 text-center text-2xs text-ink-3">
            CODNIX pode errar. Verifique informações importantes. · {projectId ? `Projeto: ${project?.name}` : 'Nenhum projeto aberto'}
          </p>
        </div>
      </div>

      <MobileNav />
      <ToastHost />

      {/* Drawer de historico */}
      {drawer && (
        <div className="fixed inset-0 z-[90] bg-black/50 md:hidden" onClick={() => setDrawer(false)}>
          <aside
            className="h-full w-72 border-r border-edge bg-panel animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-edge px-3 py-2.5">
              <span className="text-sm font-semibold">Conversas</span>
              <button onClick={() => setDrawer(false)} className="text-ink-3 hover:text-ink"><X size={16} /></button>
            </div>
            <div className="h-[calc(100%-44px)] overflow-y-auto p-2">
              <button
                className="codnix-btn-primary mb-2 w-full justify-center"
                onClick={() => {
                  newConversation(model, 'individual', projectId || undefined);
                  setDrawer(false);
                }}
              >
                Nova conversa
              </button>
              {conversations.map((c) => (
                <div
                  key={c.id}
                  className={`group flex items-center gap-1 rounded-md px-2 py-1.5 text-xs ${c.id === activeId ? 'bg-accent-soft text-ink' : 'text-ink-2 hover:bg-panel-2'}`}
                >
                  <button className="min-w-0 flex-1 truncate text-left" onClick={() => { setActive(c.id); setDrawer(false); }}>
                    {c.title}
                    <span className="block text-2xs text-ink-3">{c.messages.length} mensagens · {c.model?.split('/').pop()}</span>
                  </button>
                  <button className="opacity-0 group-hover:opacity-100 text-ink-3 hover:text-ink" title="Renomear" onClick={() => setRenaming({ id: c.id, title: c.title })}>
                    <Pencil size={12} />
                  </button>
                  <button className="opacity-0 group-hover:opacity-100 text-ink-3 hover:text-err" title="Excluir" onClick={() => deleteConversation(c.id)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {conversations.length === 0 && <p className="p-3 text-center text-xs text-ink-3">Nenhuma conversa ainda.</p>}
            </div>
          </aside>
        </div>
      )}

      {/* Renomear conversa */}
      <Modal open={!!renaming} onClose={() => setRenaming(null)} title="Renomear conversa" width={360}>
        <input
          className="codnix-input"
          value={renaming?.title || ''}
          onChange={(e) => setRenaming((r) => (r ? { ...r, title: e.target.value } : r))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && renaming) {
              renameConversation(renaming.id, renaming.title);
              setRenaming(null);
            }
          }}
        />
        <button
          className="codnix-btn-primary mt-3 w-full justify-center"
          onClick={() => {
            if (renaming) renameConversation(renaming.id, renaming.title);
            setRenaming(null);
          }}
        >
          Salvar
        </button>
      </Modal>

      {/* Anexar arquivo do projeto */}
      <Modal open={attachOpen} onClose={() => setAttachOpen(false)} title="Anexar arquivo do projeto">
        {projectId ? (
          <div className="max-h-72 overflow-y-auto rounded-md border border-edge">
            {fileTree.map((p) => (
              <button key={p} onClick={() => attachFile(p)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-ink-2 hover:bg-panel-2 hover:text-ink">
                <FileText size={13} className="text-ink-3" /> {p}
              </button>
            ))}
            {fileTree.length === 0 && <p className="p-4 text-center text-xs text-ink-3">Projeto vazio.</p>}
          </div>
        ) : (
          <p className="text-xs text-ink-2">Nenhum projeto aberto. Abra um projeto no Editor para anexar arquivos.</p>
        )}
      </Modal>

      {/* Enviar código para o projeto */}
      <Modal open={!!sendOpen} onClose={() => setSendOpen(null)} title="Enviar código para o projeto" width={420}>
        <p className="mb-3 text-xs text-ink-2">
          Crie (ou substitua) um arquivo do projeto <strong>{project?.name}</strong> com este código.
        </p>
        <input
          className="codnix-input font-mono text-xs"
          placeholder={`ex: src/${sendOpen?.lang || 'arquivo'}.${sendOpen?.lang || 'js'}`}
          value={sendPath}
          onChange={(e) => setSendPath(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void doSendToProject()}
        />
        <div className="mt-3 flex gap-2">
          <button className="codnix-btn-primary flex-1 justify-center" onClick={() => void doSendToProject()}>
            <Send size={13} /> Criar arquivo
          </button>
          <button className="codnix-btn-ghost" onClick={() => setSendOpen(null)}>Cancelar</button>
        </div>
        {fileTree.length > 0 && (
          <div className="mt-3">
            <p className="codnix-panel-title mb-1">Arquivos existentes</p>
            <div className="max-h-32 overflow-y-auto rounded-md border border-edge">
              {fileTree.map((p) => (
                <button key={p} onClick={() => setSendPath(p)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-ink-2 hover:bg-panel-2">
                  <FileText size={12} /> {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
