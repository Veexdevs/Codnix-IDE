'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, TerminalSquare, Trash2, X } from 'lucide-react';
import { diffLines, diffStats } from '@/lib/diff';
import type { ProposedChange } from '@/types';

export function DiffView({ before, after, maxHeight = 300 }: { before: string; after: string; maxHeight?: number }) {
  const lines = useMemo(() => diffLines(before, after), [before, after]);
  return (
    <div className="overflow-auto rounded-md border border-edge bg-base font-mono text-2xs" style={{ maxHeight }}>
      {lines.map((l, i) => (
        <div
          key={i}
          className={`flex gap-2 whitespace-pre-wrap break-all px-2 ${l.type === 'add' ? 'bg-ok/10 text-ok' : l.type === 'del' ? 'bg-err/10 text-err' : 'text-ink-3'}`}
        >
          <span className="w-8 shrink-0 select-none text-right text-ink-3">{l.type === 'add' ? l.newLine ?? '' : l.oldLine ?? ''}</span>
          <span className="w-3 shrink-0 select-none">{l.type === 'add' ? '+' : l.type === 'del' ? '-' : ' '}</span>
          <span className="flex-1">{l.text || ' '}</span>
        </div>
      ))}
    </div>
  );
}

export default function ProposedChanges({
  changes,
  onApply,
  onApplyAll,
  onRunCommand,
}: {
  changes: ProposedChange[];
  onApply: (change: ProposedChange) => Promise<void>;
  onApplyAll: (changes: ProposedChange[]) => Promise<void>;
  onRunCommand: (cmd: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [rejected, setRejected] = useState<Record<string, boolean>>({});
  if (changes.length === 0) return null;

  const pending = changes.filter((c) => c.status === 'pending' && !rejected[c.id]);
  const fileChanges = pending.filter((c) => c.action.type !== 'run_command');
  const commands = pending.filter((c) => c.action.type === 'run_command');

  return (
    <div className="my-2 rounded-lg border accent-border bg-panel-2 p-2">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-2xs font-semibold uppercase tracking-wide accent-text">
          Alterações propostas ({fileChanges.length} arquivos{commands.length ? `, ${commands.length} comando(s)` : ''})
        </span>
        {fileChanges.length > 0 && (
          <button className="codnix-btn-primary px-2 py-1 text-2xs" onClick={() => void onApplyAll(fileChanges)}>
            <Check size={12} /> Aceitar todas
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        {fileChanges.map((c) => {
          const stats = diffStats(diffLines(c.before || '', c.after || ''));
          const isDelete = c.action.type === 'delete_file';
          return (
            <div key={c.id} className="rounded-md border border-edge bg-panel">
              <div className="flex items-center gap-1.5 px-2 py-1.5">
                <button onClick={() => setExpanded((e) => ({ ...e, [c.id]: !e[c.id] }))} className="text-ink-3 hover:text-ink">
                  {expanded[c.id] ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>
                {isDelete ? <Trash2 size={13} className="text-err" /> : c.before ? <span className="text-2xs text-warn">M</span> : <span className="text-2xs text-ok">A</span>}
                <span className="min-w-0 flex-1 truncate font-mono text-2xs text-ink">{c.action.path}</span>
                {!isDelete && (
                  <span className="shrink-0 text-2xs text-ok">+{stats.added}</span>
                )}
                {!isDelete && <span className="shrink-0 text-2xs text-err">-{stats.removed}</span>}
                {c.status === 'applied' ? (
                  <span className="text-2xs text-ok">aplicada ✓</span>
                ) : c.status === 'error' ? (
                  <span className="text-2xs text-err" title={c.error}>erro</span>
                ) : (
                  <span className="flex shrink-0 gap-1">
                    <button className="rounded bg-ok/15 px-1.5 py-0.5 text-2xs text-ok hover:bg-ok/25" onClick={() => void onApply(c)} title="Aceitar alteração">
                      <Check size={11} />
                    </button>
                    <button
                      className="rounded bg-panel-3 px-1.5 py-0.5 text-2xs text-ink-3 hover:text-ink"
                      onClick={() => setRejected((r) => ({ ...r, [c.id]: true }))}
                      title="Rejeitar"
                    >
                      <X size={11} />
                    </button>
                  </span>
                )}
              </div>
              {expanded[c.id] && (
                <div className="px-2 pb-2">
                  {isDelete ? (
                    <p className="text-2xs text-err">Este arquivo será excluído do projeto.</p>
                  ) : c.after !== undefined ? (
                    <DiffView before={c.before || ''} after={c.after || ''} maxHeight={220} />
                  ) : (
                    <p className="text-2xs text-err">{c.error}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {commands.map((c) => (
          <div key={c.id} className="flex items-center gap-2 rounded-md border border-edge bg-panel px-2 py-1.5">
            <TerminalSquare size={13} className="shrink-0 accent-text" />
            <code className="min-w-0 flex-1 truncate font-mono text-2xs text-ink-2">{c.action.command}</code>
            <button className="codnix-btn-ghost shrink-0 px-2 py-0.5 text-2xs" onClick={() => void onRunCommand(c.action.command || '')}>
              Executar no terminal
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
