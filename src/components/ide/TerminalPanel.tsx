'use client';

import { useEffect, useRef, useState } from 'react';
import { Ban, Eraser, Plus } from 'lucide-react';
import { useApp } from '@/store/useAppStore';

export default function TerminalPanel({ compact = false }: { compact?: boolean }) {
  const { terminalLines, terminalCwd, terminalRunning, runCommand, addTerminalLine, clearTerminal, disposeTerminal, ensureTerminalSession } = useApp();
  const [input, setInput] = useState('');
  const [histIdx, setHistIdx] = useState(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const commandHistory = useApp((s) => s.commandHistory);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [terminalLines.length, terminalRunning]);

  useEffect(() => {
    if (terminalLines.length === 0) {
      addTerminalLine('CODNIX Terminal — shell bash no servidor do projeto.', 'sys');
      addTerminalLine('Comandos destrutivos (rm -rf /, sudo, etc.) são bloqueados por segurança.', 'sys');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    const cmd = input.trim();
    if (!cmd) return;
    setInput('');
    setHistIdx(-1);
    await runCommand(cmd);
    inputRef.current?.focus();
  };

  return (
    <div className="flex h-full flex-col bg-base" onClick={() => inputRef.current?.focus()}>
      <div className="flex items-center gap-2 border-b border-edge bg-panel px-3 py-1 text-2xs text-ink-3">
        <span className="rounded accent-soft-bg accent-text px-1.5 py-0.5">bash</span>
        <span className="truncate">~/{terminalCwd === '.' ? '' : terminalCwd}</span>
        <div className="flex-1" />
        <button className="rounded p-1 hover:text-ink" title="Nova sessão" onClick={() => void disposeTerminal().then(() => void ensureTerminalSession())}>
          <Plus size={12} />
        </button>
        <button className="rounded p-1 hover:text-ink" title="Limpar terminal" onClick={clearTerminal}>
          <Eraser size={12} />
        </button>
        <button className="rounded p-1 hover:text-ink" title="Encerrar sessão" onClick={() => void disposeTerminal()}>
          <Ban size={12} />
        </button>
      </div>

      <div ref={scrollRef} className={`min-h-0 flex-1 overflow-y-auto px-3 font-mono ${compact ? 'text-2xs' : 'text-xs'} leading-relaxed`}>
        {terminalLines.map((l) => (
          <div
            key={l.id}
            className={`whitespace-pre-wrap break-words ${
              l.kind === 'in' ? 'accent-text' : l.kind === 'err' ? 'text-err' : l.kind === 'ok' ? 'text-ok' : l.kind === 'sys' ? 'text-ink-3' : 'text-ink-2'
            }`}
          >
            {l.text}
          </div>
        ))}
        {terminalRunning && <div className="text-ink-3">executando... <span className="terminal-caret" /></div>}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-edge px-3 py-1.5">
        <span className="shrink-0 font-mono text-xs accent-text">$</span>
        <input
          ref={inputRef}
          value={input}
          disabled={terminalRunning}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              const idx = histIdx < 0 ? commandHistory.length - 1 : Math.max(0, histIdx - 1);
              if (commandHistory[idx] !== undefined) {
                setHistIdx(idx);
                setInput(commandHistory[idx]);
              }
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              if (histIdx >= 0 && histIdx < commandHistory.length - 1) {
                setHistIdx(histIdx + 1);
                setInput(commandHistory[histIdx + 1]);
              } else {
                setHistIdx(-1);
                setInput('');
              }
            }
          }}
          placeholder={terminalRunning ? 'aguardando comando...' : 'digite um comando e pressione Enter'}
          className="flex-1 bg-transparent font-mono text-xs text-ink outline-none placeholder:text-ink-3"
          spellCheck={false}
        />
      </div>
    </div>
  );
}
