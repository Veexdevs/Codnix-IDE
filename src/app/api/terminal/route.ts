// Terminal real server-side: executa comandos em um workspace materializado
// do projeto, com bloqueio de comandos perigosos, timeout e sincronizacao
// das alteracoes de volta para o storage do projeto.
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'node:child_process';
import path from 'node:path';
import { ensureWorkspace, materialize, syncBack, workspaceDir } from '@/lib/workspace';
import { getProject } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface Session {
  projectId: string;
  dir: string;
  cwd: string;
  createdAt: number;
}
const sessions = new Map<string, Session>();

const BLOCK_PATTERNS: { re: RegExp; reason: string }[] = [
  { re: /rm\s+(-[a-z]*\s+)*-?[rf]+\s+\/(\s|$)/i, reason: 'remoção recursiva na raiz' },
  { re: /rm\s+-rf?\s+~|rm\s+-rf?\s+\$HOME/i, reason: 'remoção recursiva do home' },
  { re: /mkfs|fdisk|parted\s+/i, reason: 'formatação de disco' },
  { re: /dd\s+.*of=\/dev\//i, reason: 'escrita direta em disco' },
  { re: /:\(\)\s*\{\s*:\|:&\s*\};:/, reason: 'fork bomb' },
  { re: /shutdown|reboot|halt|poweroff/i, reason: 'desligar máquina' },
  { re: /sudo\s+/i, reason: 'sudo não é permitido no ambiente do servidor' },
  { re: /curl[^|]*\|\s*(sudo\s+)?(ba)?sh|wget[^|]*\|\s*(sudo\s+)?(ba)?sh/i, reason: 'executar script remoto' },
  { re: /chmod\s+777\s+\/(\s|$)/i, reason: 'permissões inseguras na raiz' },
  { re: />\s*\/dev\/sd[a-z]/i, reason: 'escrita em dispositivo' },
];

function checkCommand(cmd: string): string | null {
  for (const p of BLOCK_PATTERNS) {
    if (p.re.test(cmd)) return p.reason;
  }
  return null;
}

export async function POST(req: NextRequest) {
  let body: { action?: string; projectId?: string; sessionId?: string; command?: string; shell?: string; timeout?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Corpo inválido' }, { status: 400 });
  }

  const action = body.action || 'exec';

  if (action === 'create') {
    const projectId = String(body.projectId || '');
    const project = await getProject(projectId);
    if (!project) return NextResponse.json({ ok: false, error: 'Projeto não encontrado' }, { status: 404 });
    const dir = await materialize(project, true);
    const id = `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    sessions.set(id, { projectId, dir, cwd: dir, createdAt: Date.now() });
    return NextResponse.json({ ok: true, sessionId: id, cwd: '.' });
  }

  if (action === 'dispose') {
    const id = String(body.sessionId || '');
    const s = sessions.get(id);
    if (s) {
      try {
        const { rmSync } = await import('node:fs');
        rmSync(s.dir, { recursive: true, force: true });
      } catch { /* ignore */ }
      sessions.delete(id);
    }
    return NextResponse.json({ ok: true });
  }

  // exec
  const id = String(body.sessionId || '');
  const command = String(body.command || '');
  if (!command.trim()) return NextResponse.json({ ok: false, error: 'Comando vazio' }, { status: 400 });
  if (command.length > 2000) return NextResponse.json({ ok: false, error: 'Comando muito longo' }, { status: 400 });

  const blocked = checkCommand(command);
  if (blocked) {
    return NextResponse.json({
      ok: true,
      blocked: true,
      exitCode: 126,
      output: `[CODNIX] Comando bloqueado por segurança: ${blocked}\nComandos destrutivos ou de privilégio não são permitidos no ambiente do servidor.`,
    });
  }

  let session = sessions.get(id);
  if (!session) {
    // servidor reiniciou (serverless): recria sessao se o projeto existir
    const projectId = String(body.projectId || '');
    if (projectId) {
      const dir = await ensureWorkspace(projectId);
      if (dir) {
        session = { projectId, dir, cwd: dir, createdAt: Date.now() };
        sessions.set(id, session);
      }
    }
    if (!session) {
      return NextResponse.json({ ok: false, code: 'SESSION_NOT_FOUND', error: 'Sessão de terminal não encontrada. Crie uma nova sessão.' }, { status: 404 });
    }
  }

  const timeoutMs = Math.min(Math.max(body.timeout || 30000, 2000), 55000);
  const shell = process.platform === 'win32' ? 'cmd.exe' : (body.shell === 'sh' ? '/bin/sh' : '/bin/bash');

  const cwdAbs = path.isAbsolute(session.cwd) ? session.cwd : path.join(session.dir, session.cwd);

  function runCommand(cmd: string, cwd: string, timeout: number, shell: string): Promise<{ out: string; code: number }> {
    return new Promise((resolve) => {
      exec(
        cmd,
        {
          cwd,
          shell,
          timeout,
          maxBuffer: 2 * 1024 * 1024,
          env: { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '0', NO_COLOR: '1' },
          killSignal: 'SIGKILL',
        },
        (error, stdout, stderr) => {
          const out = [stdout?.toString(), stderr?.toString()].filter(Boolean).join('\n');
          const code = error
            ? typeof error.code === 'number'
              ? error.code
              : error.killed
                ? 124
                : 1
            : 0;
          resolve({ out: out.slice(0, 200000), code });
        }
      );
    });
  }

  try {
    const { out, code } = await runCommand(command, cwdAbs, timeoutMs, shell);

    // comandos cd afetam o cwd da sessao
    if (/^\s*cd\s+/.test(command)) {
      const target = command.replace(/^\s*cd\s+/, '').trim().replace(/^["']|["']$/g, '');
      const next = path.resolve(cwdAbs, target || session.dir);
      if (next.startsWith(session.dir)) {
        session.cwd = path.relative(session.dir, next) || '.';
      }
    }

    // sincroniza alteracoes de arquivos feitas pelo comando de volta ao projeto
    let syncNote = '';
    try {
      const sync = await syncBack(session.projectId);
      const total = sync.changed.length + sync.added.length + sync.removed.length;
      if (total > 0) {
        syncNote = `[CODNIX] Projeto sincronizado: ${sync.added.length} novo(s), ${sync.changed.length} alterado(s), ${sync.removed.length} removido(s).`;
      }
    } catch {
      /* melhor esforco */
    }

    return NextResponse.json({
      ok: true,
      output: syncNote ? `${out}\n${syncNote}` : out,
      exitCode: code,
      cwd: path.relative(session.dir, session.cwd) || '.',
      sessionId: id,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
