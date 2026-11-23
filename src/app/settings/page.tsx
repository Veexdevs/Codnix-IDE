'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, BadgeCheck, Bot, Check, Database, Eye, EyeOff, KeyRound, Loader2,
  Monitor, Palette, ShieldCheck, Terminal, Trash2, Wrench, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Logo from '@/components/shared/Logo';
import MobileNav from '@/components/shared/MobileNav';
import { ToastHost, useToast } from '@/components/shared/Toast';
import { apiJson } from '@/lib/api-client';
import { useSettings } from '@/store/useSettingsStore';
import { useChat } from '@/store/useChatStore';
import { providerLabel } from '@/lib/model-utils';
import type { AgentConfig } from '@/types';

type ORKeyInfo = {
  ok: boolean;
  source?: string;
  masked?: string;
  info?: { label?: string; usage?: number | null; limit?: number | null; isFreeTier?: boolean };
  error?: string;
  code?: string;
};

type ServerSettings = { hasKey: boolean; source: string | null; masked: string | null; storage: string };

function Section({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <section className="mb-4 rounded-xl border border-edge bg-panel p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Icon size={15} className="accent-text" /> {title}
      </h2>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const toast = useToast((s) => s.show);
  const settings = useSettings();
  const { models } = useChat();
  const [server, setServer] = useState<ServerSettings | null>(null);
  const [keyInfo, setKeyInfo] = useState<ORKeyInfo | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);

  const loadServer = async () => {
    try {
      const s = await apiJson<ServerSettings>('/api/settings');
      setServer(s);
    } catch {
      setServer({ hasKey: false, source: null, masked: null, storage: '?' });
    }
  };

  const checkKey = async () => {
    setChecking(true);
    try {
      const info = await apiJson<ORKeyInfo>('/api/openrouter/key');
      setKeyInfo(info);
      if (info.ok) toast('Conexão com OpenRouter OK', 'ok');
      else toast(info.error || 'Falha ao validar chave', 'err');
    } catch (e) {
      setKeyInfo({ ok: false, error: (e as Error).message });
      toast('Falha ao validar chave', 'err');
    }
    setChecking(false);
  };

  useEffect(() => {
    void loadServer();
    if (useChat.getState().models.length === 0) void useChat.getState().loadModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveKey = async () => {
    if (!keyInput.trim()) return;
    setSaving(true);
    try {
      await apiJson('/api/settings', { method: 'POST', body: JSON.stringify({ apiKey: keyInput.trim() }) });
      setKeyInput('');
      await loadServer();
      setKeyInfo(null);
      toast('Chave salva com segurança (servidor)', 'ok');
    } catch (e) {
      toast((e as Error).message, 'err');
    }
    setSaving(false);
  };

  const clearKey = async () => {
    await apiJson('/api/settings', { method: 'POST', body: JSON.stringify({ action: 'clear' }) });
    await loadServer();
    setKeyInfo(null);
    toast('Chave removida', 'ok');
  };

  return (
    <div className="flex min-h-dvh flex-col bg-base">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-edge px-4">
        <Link href="/" className="text-ink-2 hover:text-ink"><ArrowLeft size={18} /></Link>
        <Logo size={22} withText />
        <span className="text-xs text-ink-3">· Configurações</span>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-5 pb-24">
        {/* OpenRouter */}
        <Section title="OpenRouter — Conexão" icon={KeyRound}>
          <div className="mb-3 flex items-center gap-2 text-xs">
            <span className={`flex items-center gap-1.5 rounded-full px-2 py-1 ${server?.hasKey ? 'bg-ok/10 text-ok' : 'bg-err/10 text-err'}`}>
              {server?.hasKey ? <BadgeCheck size={13} /> : <X size={13} />}
              {server?.hasKey ? `Chave configurada (${server.source === 'env' ? 'variável de ambiente' : 'configuração segura'})` : 'Nenhuma chave configurada'}
            </span>
            {server?.masked && <span className="font-mono text-2xs text-ink-3">{server.masked}</span>}
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                className="codnix-input pr-9 font-mono text-xs"
                placeholder="sk-or-v1-...  (sua chave do OpenRouter)"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void saveKey()}
              />
              <button onClick={() => setShowKey((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink" title={showKey ? 'Ocultar' : 'Mostrar'}>
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <button className="codnix-btn-primary shrink-0" onClick={() => void saveKey()} disabled={saving || !keyInput.trim()}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Salvar
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="codnix-btn-ghost text-xs" onClick={() => void checkKey()} disabled={checking}>
              {checking ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />} Testar conexão
            </button>
            {server?.source === 'settings' && (
              <button className="codnix-btn-ghost text-xs text-err" onClick={() => void clearKey()}>
                <Trash2 size={13} /> Remover chave
              </button>
            )}
          </div>
          <p className="mt-2 text-2xs leading-relaxed text-ink-3">
            A chave é armazenada apenas no servidor (nunca no navegador) e pode ser alterada a qualquer momento.
            Alternativamente, defina a variável de ambiente <code className="rounded bg-panel-3 px-1">OPENROUTER_API_KEY</code>.
            <br />
            Crie sua chave em <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="accent-text underline">openrouter.ai/keys</a>.
          </p>
          {keyInfo?.ok && keyInfo.info && (
            <div className="mt-3 rounded-lg border border-edge bg-panel-2 p-3 text-2xs text-ink-2">
              <p className="mb-1 font-medium text-ok">Conectado{keyInfo.info.label ? ` · ${keyInfo.info.label}` : ''}</p>
              <p>Uso: ${Number(keyInfo.info.usage ?? 0).toFixed(4)} {keyInfo.info.limit != null ? `de $${Number(keyInfo.info.limit).toFixed(2)}` : '(sem limite definido)'}</p>
              {keyInfo.info.isFreeTier != null && <p>Conta gratuita do OpenRouter: {keyInfo.info.isFreeTier ? 'sim' : 'não'}</p>}
            </div>
          )}
          {keyInfo && !keyInfo.ok && (
            <p className="mt-2 rounded-lg border border-err/40 bg-err/10 p-2 text-2xs text-err">{keyInfo.error}</p>
          )}
        </Section>

        {/* Persistencia */}
        <Section title="Persistência de dados" icon={Database}>
          <p className="text-xs text-ink-2">
            Modo atual: <strong>{server?.storage === 'supabase' ? 'Supabase (Postgres, sincronizado em todos os dispositivos)' : 'arquivos locais (data/) no servidor'}</strong>
          </p>
          <p className="mt-1 text-2xs text-ink-3">
            Configure as variáveis <code className="rounded bg-panel-3 px-1">SUPABASE_URL</code> e <code className="rounded bg-panel-3 px-1">SUPABASE_API_KEY</code> para
            persistência em nuvem (Vercel). Sem elas, os dados ficam no diretório local do servidor.
          </p>
        </Section>

        {/* Aparencia */}
        <Section title="Aparência & Idioma" icon={Palette}>
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="mb-1 block text-2xs text-ink-2">Cor de destaque</label>
              <div className="flex gap-1.5">
                {(['blue', 'violet', 'green', 'orange'] as const).map((a) => (
                  <button
                    key={a}
                    onClick={() => settings.set('accent', a)}
                    className={`h-7 w-7 rounded-full border-2 ${settings.accent === a ? 'border-ink' : 'border-transparent'}`}
                    style={{ background: { blue: '#2f7bff', violet: '#8b5cf6', green: '#22c55e', orange: '#f97316' }[a] }}
                    title={a}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-2xs text-ink-2">Idioma</label>
              <select className="codnix-select" value={settings.language} onChange={(e) => settings.set('language', e.target.value as 'pt' | 'en')}>
                <option value="pt">Português (BR)</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
        </Section>

        {/* Editor */}
        <Section title="Editor" icon={Wrench}>
          <div className="grid grid-cols-2 gap-3 text-xs md:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="text-2xs text-ink-2">Tamanho da fonte</span>
              <input type="number" min={10} max={24} className="codnix-input py-1" value={settings.editor.fontSize} onChange={(e) => settings.set('editor', { ...settings.editor, fontSize: Number(e.target.value) || 14 })} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-2xs text-ink-2">Espaços (tab)</span>
              <input type="number" min={2} max={8} className="codnix-input py-1" value={settings.editor.tabSize} onChange={(e) => settings.set('editor', { ...settings.editor, tabSize: Number(e.target.value) || 4 })} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-2xs text-ink-2">Salvamento automático</span>
              <select className="codnix-select" value={settings.editor.autoSave ? '1' : '0'} onChange={(e) => settings.set('editor', { ...settings.editor, autoSave: e.target.value === '1' })}>
                <option value="1">Ativado</option>
                <option value="0">Desativado</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-2xs text-ink-2">Quebra de linha</span>
              <select className="codnix-select" value={settings.editor.wordWrap ? '1' : '0'} onChange={(e) => settings.set('editor', { ...settings.editor, wordWrap: e.target.value === '1' })}>
                <option value="1">Ativada</option>
                <option value="0">Desativada</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-2xs text-ink-2">Minimapa</span>
              <select className="codnix-select" value={settings.editor.minimap ? '1' : '0'} onChange={(e) => settings.set('editor', { ...settings.editor, minimap: e.target.value === '1' })}>
                <option value="1">Visível</option>
                <option value="0">Oculto</option>
              </select>
            </label>
          </div>
        </Section>

        {/* Terminal */}
        <Section title="Terminal" icon={Terminal}>
          <div className="flex flex-wrap gap-3 text-xs">
            <label className="flex flex-col gap-1">
              <span className="text-2xs text-ink-2">Shell</span>
              <select className="codnix-select" value={settings.terminal.shell} onChange={(e) => settings.set('terminal', { ...settings.terminal, shell: e.target.value as 'bash' | 'sh' })}>
                <option value="bash">bash</option>
                <option value="sh">sh</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-2xs text-ink-2">Timeout (segundos)</span>
              <input type="number" min={5} max={55} className="codnix-input w-24 py-1" value={Math.round(settings.terminal.timeout / 1000)} onChange={(e) => settings.set('terminal', { ...settings.terminal, timeout: (Number(e.target.value) || 30) * 1000 })} />
            </label>
          </div>
          <p className="mt-2 text-2xs text-ink-3">
            Comandos destrutivos (rm -rf /, sudo, scripts remotos, etc.) são bloqueados automaticamente por segurança.
          </p>
        </Section>

        {/* Agentes */}
        <Section title="Configuração de agentes (Modo Equipe)" icon={Bot}>
          <div className="flex flex-col gap-2">
            {settings.agents.map((a: AgentConfig) => (
              <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-edge bg-panel-2 p-2">
                <input
                  className="codnix-input w-28 py-1 text-xs"
                  value={a.role}
                  onChange={(e) => settings.updateAgent(a.id, { role: e.target.value })}
                  title="Nome do agente"
                />
                <select
                  className="codnix-select flex-1"
                  value={a.model}
                  onChange={(e) => settings.updateAgent(a.id, { model: e.target.value })}
                  title="Modelo do agente"
                >
                  <option value="">Selecione o modelo...</option>
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>{providerLabel(m.provider)} · {m.name}</option>
                  ))}
                </select>
                <button className="text-ink-3 hover:text-err" onClick={() => settings.removeAgent(a.id)} title="Remover agente">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            <button className="codnix-btn-ghost w-fit text-xs" onClick={settings.addAgent}>
              + Adicionar agente
            </button>
            <label className="mt-1 flex flex-col gap-1 text-xs">
              <span className="text-2xs text-ink-2">Consolidador final (integra as respostas)</span>
              <select className="codnix-select" value={settings.teamConsolidator} onChange={(e) => settings.set('teamConsolidator', e.target.value)}>
                <option value="">Automático (primeiro agente)</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>{providerLabel(m.provider)} · {m.name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-2xs text-ink-2">Orçamento máximo de requisições por tarefa</span>
              <input type="number" min={2} max={20} className="codnix-input w-28 py-1" value={settings.maxRequests} onChange={(e) => settings.set('maxRequests', Number(e.target.value) || 8)} />
            </label>
          </div>
        </Section>

        {/* Privacidade */}
        <Section title="Privacidade & Contexto" icon={ShieldCheck}>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={settings.privacy.sendContext}
              onChange={(e) => settings.set('privacy', { ...settings.privacy, sendContext: e.target.checked })}
            />
            Enviar contexto do projeto (estrutura e arquivos selecionados) para as IAs
          </label>
          <label className="mt-2 flex flex-col gap-1 text-xs">
            <span className="text-2xs text-ink-2">Pastas excluídas do contexto (separadas por vírgula)</span>
            <input
              className="codnix-input py-1 font-mono text-xs"
              value={settings.privacy.excludedDirs.join(', ')}
              onChange={(e) => settings.set('privacy', { ...settings.privacy, excludedDirs: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
            />
          </label>
          <p className="mt-2 text-2xs text-ink-3">
            O CODNIX nunca envia todos os arquivos automaticamente — apenas o índice do projeto e os arquivos que você
            selecionar, respeitando o orçamento de contexto.
          </p>
        </Section>

        <Section title="Atalhos de teclado" icon={Monitor}>
          <div className="grid grid-cols-1 gap-1.5 text-xs text-ink-2 md:grid-cols-2">
            {[
              ['Ctrl/Cmd + S', 'Salvar arquivo'],
              ['Ctrl/Cmd + P', 'Busca rápida de arquivo'],
              ['Ctrl/Cmd + F', 'Buscar no arquivo'],
              ['Ctrl/Cmd + H', 'Substituir no arquivo'],
              ['Ctrl/Cmd + B', 'Mostrar/ocultar Explorer'],
              ['Ctrl/Cmd + J', 'Mostrar/ocultar painel inferior'],
            ].map(([k, d]) => (
              <div key={k} className="flex items-center justify-between rounded bg-panel-2 px-2.5 py-1.5">
                <span>{d}</span>
                <kbd className="rounded border border-edge bg-panel-3 px-1.5 py-0.5 font-mono text-2xs">{k}</kbd>
              </div>
            ))}
          </div>
        </Section>
      </main>

      <MobileNav />
      <ToastHost />
    </div>
  );
}
