'use client';

import { create } from 'zustand';
import { apiJson } from '@/lib/api-client';
import { streamChat } from '@/lib/streaming';
import { uid, nowIso, truncate, estimateTokens } from '@/lib/utils';
import { buildDevSystemPrompt, extractActions } from '@/lib/dev-tools';
import { useSettings } from './useSettingsStore';
import type { AgentConfig, ChatMessage, ChatMode, Conversation, ORModel, ProposedChange } from '@/types';

const LS_CONVOS = 'codnix-conversations-v1';

function loadLocalConversations(): Conversation[] {
  try {
    return JSON.parse(localStorage.getItem(LS_CONVOS) || '[]') as Conversation[];
  } catch {
    return [];
  }
}

interface TeamRunState {
  running: boolean;
  cancelled: boolean;
  currentStep: string;
  requestsUsed: number;
}

interface ChatStore {
  conversations: Conversation[];
  activeId: string | null;
  loaded: boolean;
  models: ORModel[];
  modelsLoading: boolean;
  modelsError: string | null;
  modelsFetchedAt: number | null;
  streaming: boolean;
  generationState: { messageIndex: number; label: string } | null;
  team: TeamRunState;
  abortController: AbortController | null;
  serverSync: boolean;

  loadModels(refresh?: boolean): Promise<void>;
  loadConversations(): Promise<void>;
  persistConversation(conv: Conversation): void;

  setActive(id: string | null): void;
  activeConversation(): Conversation | null;
  newConversation(model: string, mode?: ChatMode, projectId?: string): Conversation;
  deleteConversation(id: string): void;
  renameConversation(id: string, title: string): void;
  setConversationMode(id: string, mode: ChatMode): void;
  setConversationModel(id: string, model: string): void;
  updateMessage(convId: string, msgId: string, patch: Partial<ChatMessage>): void;

  cancel(): void;

  // modos
  sendIndividual(text: string, opts?: { contextFiles?: { path: string; content: string }[]; projectOutline?: string; projectName?: string; attachments?: { path: string; name: string; content: string }[] }): Promise<void>;
  sendTeam(text: string, agents: AgentConfig[], opts?: { contextFiles?: { path: string; content: string }[]; projectOutline?: string; projectName?: string }): Promise<void>;
  sendComparison(text: string, models: string[], opts?: { contextFiles?: { path: string; content: string }[]; projectName?: string }): Promise<void>;
  sendDeveloper(text: string, opts?: { contextFiles?: { path: string; content: string }[]; projectOutline?: string; projectName?: string; files?: Record<string, string> }): Promise<ProposedChange[]>;
  sendReview(text: string, writerModel: string, reviewerModels: string[], opts?: { contextFiles?: { path: string; content: string }[]; projectName?: string }): Promise<void>;
}

const ROLE_PROMPTS: Record<string, string> = {
  analyst: 'Você é o Analista da equipe. Analise o projeto/tarefa com profundidade: pontos-chave, requisitos, riscos e o que precisa ser feito. Seja objetivo (máx ~200 palavras).',
  planner: 'Você é o Planejador da equipe. Com base na análise anterior, planeje a implementação passo a passo: arquivos a criar/modificar, ordem das tarefas e decisões técnicas. Seja específico.',
  reviewer: 'Você é o Revisor da equipe. Revise criticamente a solução proposta anteriormente: aponte falhas, melhorias, casos de borda e simplificações.',
  debugger: 'Você é o Depurador da equipe. Liste os possíveis erros, bugs, problemas de segurança e performance da solução proposta, e como corrigi-los.',
  implementer: 'Você é o Implementador da equipe. Escreva o código solicitado de forma completa e funcional.',
  consolidator: 'Você é o Consolidador da equipe. Integre as contribuições anteriores dos agentes em uma resposta final única, coerente e acionável para o usuário. Remova repetições e resolva divergências. Responda em markdown.',
  custom: '',
};

export const useChat = create<ChatStore>()((set, get) => ({
  conversations: [],
  activeId: null,
  loaded: false,
  models: [],
  modelsLoading: false,
  modelsError: null,
  modelsFetchedAt: null,
  streaming: false,
  generationState: null,
  team: { running: false, cancelled: false, currentStep: '', requestsUsed: 0 },
  abortController: null,
  serverSync: false,

  loadModels: async (refresh) => {
    if (get().modelsLoading) return;
    set({ modelsLoading: true, modelsError: null });
    try {
      const res = await apiJson<{ models: ORModel[]; fetchedAt: number; warning?: string }>(`/api/models${refresh ? '?refresh=1' : ''}`);
      set({ models: res.models, modelsLoading: false, modelsFetchedAt: res.fetchedAt, modelsError: res.warning || null });
    } catch (e) {
      set({ modelsLoading: false, modelsError: (e as Error).message });
    }
  },

  loadConversations: async () => {
    // sincroniza com o servidor; fallback: localStorage
    try {
      const res = await apiJson<{ conversations: Conversation[] }>('/api/chats');
      const remote = res.conversations || [];
      const local = loadLocalConversations();
      // mescla: remoto tem prioridade; conversas locais nao presentes no remoto sao enviadas ao servidor
      const byId = new Map(remote.map((c) => [c.id, c]));
      for (const c of local) {
        const r = byId.get(c.id);
        if (!r || new Date(c.updatedAt) > new Date(r.updatedAt)) byId.set(c.id, c);
        if (!r || new Date(c.updatedAt) > new Date(r.updatedAt)) {
          void apiJson('/api/chats', { method: 'POST', body: JSON.stringify(c) }).catch(() => {});
        }
      }
      const merged = Array.from(byId.values()).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
      set({ conversations: merged, loaded: true, serverSync: true });
      localStorage.setItem(LS_CONVOS, JSON.stringify(merged.slice(0, 60)));
    } catch {
      const local = loadLocalConversations();
      set({ conversations: local, loaded: true, serverSync: false });
    }
    if (!get().activeId) {
      const first = get().conversations[0];
      set({ activeId: first?.id || null });
    }
  },

  persistConversation: (conv) => {
    const others = get().conversations.filter((c) => c.id !== conv.id);
    const all = [conv, ...others].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    set({ conversations: all });
    localStorage.setItem(LS_CONVOS, JSON.stringify(all.slice(0, 60)));
    void apiJson('/api/chats', { method: 'POST', body: JSON.stringify(conv) }).catch(() => {});
  },

  setActive: (id) => set({ activeId: id }),
  activeConversation: () => get().conversations.find((c) => c.id === get().activeId) || null,

  newConversation: (model, mode = 'individual', projectId) => {
    const conv: Conversation = {
      id: uid('c_'),
      title: 'Nova conversa',
      model,
      mode,
      projectId,
      messages: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    get().persistConversation(conv);
    set({ activeId: conv.id });
    return conv;
  },

  deleteConversation: (id) => {
    const conversations = get().conversations.filter((c) => c.id !== id);
    set({ conversations, activeId: get().activeId === id ? conversations[0]?.id || null : get().activeId });
    localStorage.setItem(LS_CONVOS, JSON.stringify(conversations.slice(0, 60)));
    void apiJson(`/api/chats?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
  },

  renameConversation: (id, title) => {
    const conv = get().conversations.find((c) => c.id === id);
    if (!conv) return;
    const updated = { ...conv, title: title.slice(0, 80) || 'Nova conversa', updatedAt: nowIso() };
    get().persistConversation(updated);
  },

  setConversationMode: (id, mode) => {
    const conv = get().conversations.find((c) => c.id === id);
    if (!conv) return;
    get().persistConversation({ ...conv, mode, updatedAt: nowIso() });
  },

  setConversationModel: (id, model) => {
    const conv = get().conversations.find((c) => c.id === id);
    if (!conv) return;
    get().persistConversation({ ...conv, model, updatedAt: nowIso() });
  },

  updateMessage: (convId, msgId, patch) => {
    const conv = get().conversations.find((c) => c.id === convId);
    if (!conv) return;
    const messages = conv.messages.map((m) => (m.id === msgId ? { ...m, ...patch } : m));
    get().persistConversation({ ...conv, messages });
  },

  cancel: () => {
    get().abortController?.abort();
    set({ abortController: null, streaming: false, generationState: null, team: { ...get().team, running: false } });
  },

  // ============ MODO INDIVIDUAL ============
  sendIndividual: async (text, opts) => {
    const settings = useSettings.getState();
    const conv = get().activeConversation() || get().newConversation(settings.defaultModel || get().models[0]?.id || '');
    const userMsg: ChatMessage = {
      id: uid('m_'),
      role: 'user',
      content: text,
      createdAt: nowIso(),
      attachments: opts?.attachments,
    };
    const assistantMsg: ChatMessage = {
      id: uid('m_'),
      role: 'assistant',
      content: '',
      model: conv.model,
      createdAt: nowIso(),
      streaming: true,
    };
    const updated = { ...conv, messages: [...conv.messages, userMsg, assistantMsg], updatedAt: nowIso() };
    if (conv.messages.length === 0) {
      updated.title = text.slice(0, 60) || 'Nova conversa';
    }
    get().persistConversation(updated);
    set({ activeId: updated.id });

    const ac = new AbortController();
    set({ abortController: ac, streaming: true, generationState: { messageIndex: updated.messages.length - 1, label: conv.model } });

    // historico da conversa (ultimas 20 mensagens, sem streaming pendente)
    const history = conv.messages.slice(-20).map((m) => ({ role: m.role === 'system' ? ('user' as const) : (m.role as 'user' | 'assistant'), content: m.content }));

    const contextBlock = (opts?.contextFiles || [])
      .map((f) => truncate(`--- Arquivo: ${f.path} ---\n${f.content}`, 12000))
      .join('\n\n');
    const systemParts: string[] = ['Você é o Codnix Assistant, integrado ao CODNIX IDE. Responda em markdown, com blocos de código quando útil.'];
    if (opts?.projectName) systemParts.push(`Projeto atual do usuário: "${opts.projectName}".`);
    if (opts?.projectOutline && settings.privacy.sendContext) systemParts.push(`Estrutura do projeto:\n${truncate(opts.projectOutline, 6000)}`);
    if (contextBlock && settings.privacy.sendContext) systemParts.push(`Arquivos selecionados pelo usuário como contexto:\n${contextBlock}`);

    const payload = [
      ...(systemParts.length > 1 ? [{ role: 'system' as const, content: systemParts.join('\n\n') }] : []),
      ...history,
      { role: 'user' as const, content: opts?.attachments?.length
        ? `${text}\n\n${opts.attachments.map((a) => `--- Arquivo anexado: ${a.name} ---\n${truncate(a.content, 12000)}`).join('\n\n')}`
        : text },
    ];

    const result = await streamChat({
      model: conv.model,
      messages: payload,
      signal: ac.signal,
      onDelta: (_chunk, full) => {
        get().updateMessage(updated.id, assistantMsg.id, { content: full });
      },
    });

    set({ streaming: false, generationState: null, abortController: null });
    get().updateMessage(updated.id, assistantMsg.id, {
      content: result.content || '',
      streaming: false,
      model: result.model || conv.model,
      error: result.error && result.error !== '__aborted__' ? result.error : undefined,
      errorCode: result.errorCode,
      elapsedMs: Date.now() - new Date(assistantMsg.createdAt).getTime(),
    });
    // registra modelo usado no projeto
    if (conv.projectId && (result.model || conv.model)) {
      void apiJson(`/api/projects/${conv.projectId}`, {
        method: 'PATCH',
        body: JSON.stringify({ modelUsed: result.model || conv.model }),
      }).catch(() => {});
    }
  },

  // ============ MODO EQUIPE ============
  sendTeam: async (text, agents, opts) => {
    const settings = useSettings.getState();
    const conv = get().activeConversation() || get().newConversation(settings.defaultModel || get().models[0]?.id || '', 'team');
    const budget = Math.max(settings.maxRequests, agents.length + 1);
    const usableAgents = agents.filter((a) => a.model).slice(0, Math.max(budget - 1, 1));
    if (usableAgents.length === 0) {
      const errMsg: ChatMessage = {
        id: uid('m_'), role: 'assistant', content: 'Nenhum agente configurado. Vá em **Agentes** (aba no painel do assistente ou Configurações) e selecione os modelos de cada agente.',
        createdAt: nowIso(), error: undefined,
      };
      get().persistConversation({ ...conv, messages: [...conv.messages, errMsg], updatedAt: nowIso() });
      return;
    }

    const userMsg: ChatMessage = { id: uid('m_'), role: 'user', content: `👥 **Modo Equipe** (${usableAgents.length + 1} IAs)\n\n${text}`, createdAt: nowIso() };
    const base = { ...conv, messages: [...conv.messages, userMsg], updatedAt: nowIso(), mode: 'team' as ChatMode, title: conv.messages.length === 0 ? `Equipe: ${text.slice(0, 50)}` : conv.title };
    get().persistConversation(base);
    set({ activeId: base.id });

    const ac = new AbortController();
    set({
      abortController: ac,
      streaming: true,
      team: { running: true, cancelled: false, currentStep: 'iniciando', requestsUsed: 0 },
    });

    const contextBlock = (opts?.contextFiles || []).map((f) => truncate(`--- Arquivo: ${f.path} ---\n${f.content}`, 8000)).join('\n\n');
    const contextHeader = opts?.projectName
      ? `Tarefa do usuário no projeto "${opts.projectName}": ${text}\n\n${opts.projectOutline && settings.privacy.sendContext ? `Estrutura do projeto:\n${truncate(opts.projectOutline, 4000)}\n\n` : ''}${contextBlock && settings.privacy.sendContext ? `Arquivos de contexto:\n${contextBlock}` : ''}`
      : `Tarefa do usuário: ${text}\n\n${contextBlock && settings.privacy.sendContext ? `Arquivos de contexto:\n${contextBlock}` : ''}`;

    let accumulated = '';
    const requests: { label: string; model: string }[] = [];

    for (let i = 0; i < usableAgents.length; i++) {
      if (ac.signal.aborted) break;
      if (get().team.requestsUsed >= budget) break;
      const agent = usableAgents[i];
      const label = `${agent.role} (${agent.model.split('/').pop()})`;
      const agentMsg: ChatMessage = {
        id: uid('m_'), role: 'assistant', content: '', model: agent.model, agentLabel: `• ${agent.role}`, createdAt: nowIso(), streaming: true,
      };
      const withAgent: Conversation = { ...get().activeConversation()!, messages: [...get().activeConversation()!.messages, agentMsg], updatedAt: nowIso() };
      get().persistConversation(withAgent);
      set({ generationState: { messageIndex: withAgent.messages.length - 1, label }, team: { ...get().team, currentStep: label, requestsUsed: get().team.requestsUsed + 1 } });

      const rolePrompt = agent.customInstruction?.trim() || ROLE_PROMPTS[agent.roleKey] || ROLE_PROMPTS.custom || `Você é o agente ${agent.role}.`;
      const prev = truncate(accumulated, 8000);
      const result = await streamChat({
        model: agent.model,
        messages: [
          { role: 'system', content: `${rolePrompt}\nVocê é parte de uma equipe de IAs do CODNIX IDE trabalhando na mesma tarefa. Responda em markdown.` },
          { role: 'user', content: `${contextHeader}\n\n${prev ? `Contribuições dos agentes anteriores:\n${prev}\n\n` : ''}Sua etapa agora.` },
        ],
        signal: ac.signal,
        onDelta: (_c, full) => get().updateMessage(withAgent.id, agentMsg.id, { content: full }),
      });
      get().updateMessage(withAgent.id, agentMsg.id, {
        content: result.content, streaming: false,
        error: result.error && result.error !== '__aborted__' ? result.error : undefined,
        errorCode: result.errorCode,
      });
      requests.push({ label: agent.role, model: agent.model });
      if (result.content) accumulated += `\n\n### ${agent.role}\n${result.content}`;
      if (result.error) break;
    }

    // consolidador
    if (!ac.signal.aborted && get().team.requestsUsed < budget && accumulated) {
      const consolidatorModel = settings.teamConsolidator || usableAgents[0].model;
      const consMsg: ChatMessage = {
        id: uid('m_'), role: 'assistant', content: '', model: consolidatorModel, agentLabel: '★ Consolidação', createdAt: nowIso(), streaming: true,
      };
      const withCons: Conversation = { ...get().activeConversation()!, messages: [...get().activeConversation()!.messages, consMsg], updatedAt: nowIso() };
      get().persistConversation(withCons);
      set({ generationState: { messageIndex: withCons.messages.length - 1, label: `Consolidação (${consolidatorModel.split('/').pop()})` }, team: { ...get().team, currentStep: 'consolidação', requestsUsed: get().team.requestsUsed + 1 } });
      const result = await streamChat({
        model: consolidatorModel,
        messages: [
          { role: 'system', content: ROLE_PROMPTS.consolidator },
          { role: 'user', content: `Tarefa original: ${text}\n\nContribuições da equipe:\n${truncate(accumulated, 12000)}\n\nProduza a resposta final consolidada.` },
        ],
        signal: ac.signal,
        onDelta: (_c, full) => get().updateMessage(withCons.id, consMsg.id, { content: full }),
      });
      get().updateMessage(withCons.id, consMsg.id, {
        content: result.content, streaming: false,
        error: result.error && result.error !== '__aborted__' ? result.error : undefined,
        errorCode: result.errorCode,
      });
    }

    set({ streaming: false, generationState: null, abortController: null, team: { running: false, cancelled: false, currentStep: '', requestsUsed: 0 } });
  },

  // ============ MODO COMPARACAO ============
  sendComparison: async (text, models, opts) => {
    if (models.length < 2) return;
    const conv = get().activeConversation() || get().newConversation(models[0], 'comparison');
    const userMsg: ChatMessage = { id: uid('m_'), role: 'user', content: `⚖️ **Modo Comparação** — ${models.length} modelos\n\n${text}`, createdAt: nowIso() };
    const withUser: Conversation = { ...conv, messages: [...conv.messages, userMsg], updatedAt: nowIso(), mode: 'comparison', title: conv.messages.length === 0 ? `Comparação: ${text.slice(0, 50)}` : conv.title };
    get().persistConversation(withUser);
    set({ activeId: withUser.id });

    const ac = new AbortController();
    set({ abortController: ac, streaming: true });

    const contextBlock = (opts?.contextFiles || []).map((f) => truncate(`--- Arquivo: ${f.path} ---\n${f.content}`, 8000)).join('\n\n');
    const payloadText = `${text}\n\n${contextBlock ? `Contexto do projeto:\n${contextBlock}` : ''}`;

    const assistantMsgs = models.map((m) => ({
      id: uid('m_'),
      msg: { id: '', role: 'assistant' as const, content: '', model: m, agentLabel: m.split('/').pop(), createdAt: nowIso(), streaming: true } as ChatMessage,
    }));
    // cria mensagens placeholder
    let cur = get().activeConversation()!;
    for (const a of assistantMsgs) {
      a.msg.id = uid('m_');
      cur = { ...cur, messages: [...cur.messages, a.msg], updatedAt: nowIso() };
      get().persistConversation(cur);
    }

    await Promise.all(
      assistantMsgs.map(async (a) => {
        const result = await streamChat({
          model: a.msg.model!,
          messages: [
            { role: 'system', content: 'Você é um assistente do CODNIX IDE respondendo em modo comparação. Responda em markdown, direto ao ponto.' },
            { role: 'user', content: payloadText },
          ],
          signal: ac.signal,
          onDelta: (_c, full) => get().updateMessage(cur.id, a.msg.id, { content: full }),
        });
        get().updateMessage(cur.id, a.msg.id, {
          content: result.content, streaming: false,
          error: result.error && result.error !== '__aborted__' ? result.error : undefined,
          errorCode: result.errorCode,
        });
      })
    );

    set({ streaming: false, generationState: null, abortController: null });
  },

  // ============ MODO DESENVOLVEDOR ============
  sendDeveloper: async (text, opts) => {
    const settings = useSettings.getState();
    const conv = get().activeConversation() || get().newConversation(settings.defaultModel || get().models[0]?.id || '', 'developer');
    const userMsg: ChatMessage = { id: uid('m_'), role: 'user', content: `🛠 **Modo Desenvolvedor**\n\n${text}`, createdAt: nowIso() };
    const assistantMsg: ChatMessage = { id: uid('m_'), role: 'assistant', content: '', model: conv.model, createdAt: nowIso(), streaming: true };
    const updated: Conversation = { ...conv, messages: [...conv.messages, userMsg, assistantMsg], updatedAt: nowIso(), mode: 'developer', title: conv.messages.length === 0 ? `Dev: ${text.slice(0, 50)}` : conv.title };
    get().persistConversation(updated);
    set({ activeId: updated.id });

    const ac = new AbortController();
    set({ abortController: ac, streaming: true, generationState: { messageIndex: updated.messages.length - 1, label: conv.model } });

    const contextBlock = (opts?.contextFiles || []).map((f) => truncate(`--- Arquivo: ${f.path} ---\n${f.content}`, 10000)).join('\n\n');
    const system = buildDevSystemPrompt(opts?.projectName || 'projeto', truncate(opts?.projectOutline || '', 5000), truncate(contextBlock, 12000));
    const history = conv.messages.slice(-10).map((m) => ({ role: m.role === 'system' ? ('user' as const) : (m.role as 'user' | 'assistant'), content: m.content }));

    const result = await streamChat({
      model: conv.model,
      messages: [{ role: 'system', content: system }, ...history, { role: 'user', content: text }],
      signal: ac.signal,
      onDelta: (_c, full) => get().updateMessage(updated.id, assistantMsg.id, { content: full }),
    });

    set({ streaming: false, generationState: null, abortController: null });

    const { actions, cleanText } = extractActions(result.content);
    const changes: ProposedChange[] = [];
    const files = opts?.files || {};
    for (const action of actions) {
      if (action.type === 'create_file' && action.path) {
        const before = files[action.path] ?? '';
        changes.push({ id: uid('ch_'), action, before, after: action.content, status: 'pending' });
      } else if (action.type === 'edit_file' && action.path) {
        const before = files[action.path] ?? '';
        const after = action.content != null
          ? action.content
          : action.find && before.includes(action.find)
            ? before.replace(action.find, action.replace || '')
            : undefined;
        changes.push({ id: uid('ch_'), action, before, after, status: after === undefined ? 'error' : 'pending', error: after === undefined ? 'Trecho "find" não encontrado no arquivo' : undefined });
      } else {
        changes.push({ id: uid('ch_'), action, status: 'pending' });
      }
    }
    get().updateMessage(updated.id, assistantMsg.id, {
      content: cleanText || result.content,
      streaming: false,
      model: result.model || conv.model,
      error: result.error && result.error !== '__aborted__' ? result.error : undefined,
      errorCode: result.errorCode,
      actions,
      elapsedMs: Date.now() - new Date(assistantMsg.createdAt).getTime(),
    });
    void estimateTokens(text);
    return changes;
  },

  // ============ MODO REVISAO ============
  sendReview: async (text, writerModel, reviewerModels, opts) => {
    const conv = get().activeConversation() || get().newConversation(writerModel, 'review');
    const userMsg: ChatMessage = { id: uid('m_'), role: 'user', content: `🔍 **Modo Revisão** — escrita por ${writerModel.split('/').pop()}, revisão por ${reviewerModels.length} IAs\n\n${text}`, createdAt: nowIso() };
    const withUser: Conversation = { ...conv, messages: [...conv.messages, userMsg], updatedAt: nowIso(), mode: 'review', title: conv.messages.length === 0 ? `Revisão: ${text.slice(0, 50)}` : conv.title };
    get().persistConversation(withUser);
    set({ activeId: withUser.id });

    const ac = new AbortController();
    set({ abortController: ac, streaming: true });

    const contextBlock = (opts?.contextFiles || []).map((f) => truncate(`--- Arquivo: ${f.path} ---\n${f.content}`, 8000)).join('\n\n');

    // 1. escritor
    const writerMsg: ChatMessage = { id: uid('m_'), role: 'assistant', content: '', model: writerModel, agentLabel: '✍️ Código', createdAt: nowIso(), streaming: true };
    let cur = get().activeConversation()!;
    writerMsg.id = uid('m_');
    cur = { ...cur, messages: [...cur.messages, writerMsg], updatedAt: nowIso() };
    get().persistConversation(cur);
    set({ generationState: { messageIndex: cur.messages.length - 1, label: `Escrita (${writerModel.split('/').pop()})` } });

    const writerResult = await streamChat({
      model: writerModel,
      messages: [
        { role: 'system', content: 'Você é o Codnix Writer. Escreva código completo, funcional e bem comentado para a tarefa. Responda em markdown com blocos de código.' },
        { role: 'user', content: `${text}${contextBlock ? `\n\nContexto do projeto:\n${contextBlock}` : ''}` },
      ],
      signal: ac.signal,
      onDelta: (_c, full) => get().updateMessage(cur.id, writerMsg.id, { content: full }),
    });
    get().updateMessage(cur.id, writerMsg.id, {
      content: writerResult.content, streaming: false,
      error: writerResult.error && writerResult.error !== '__aborted__' ? writerResult.error : undefined,
      errorCode: writerResult.errorCode,
    });

    // 2. revisores em paralelo
    if (!writerResult.error && reviewerModels.length > 0) {
      const reviewerMsgs = reviewerModels.map((m) => {
        const msg: ChatMessage = { id: uid('m_'), role: 'assistant', content: '', model: m, agentLabel: `🔎 ${m.split('/').pop()}`, createdAt: nowIso(), streaming: true };
        return msg;
      });
      let cur2 = get().activeConversation()!;
      for (const msg of reviewerMsgs) {
        cur2 = { ...cur2, messages: [...cur2.messages, msg], updatedAt: nowIso() };
        get().persistConversation(cur2);
      }
      await Promise.all(
        reviewerMsgs.map((msg) =>
          streamChat({
            model: msg.model!,
            messages: [
              { role: 'system', content: 'Você é o Codnix Reviewer. Revise o código abaixo: bugs, segurança, performance, clareza e casos de borda. Liste problemas e sugira correções concretas. Responda em markdown.' },
              { role: 'user', content: `Tarefa: ${text}\n\nCódigo escrito por outro modelo:\n\n${truncate(writerResult.content, 12000)}` },
            ],
            signal: ac.signal,
            onDelta: (_c, full) => get().updateMessage(cur2.id, msg.id, { content: full }),
          }).then((result) =>
            get().updateMessage(cur2.id, msg.id, {
              content: result.content, streaming: false,
              error: result.error && result.error !== '__aborted__' ? result.error : undefined,
              errorCode: result.errorCode,
            })
          )
        )
      );
    }

    set({ streaming: false, generationState: null, abortController: null });
  },
}));
