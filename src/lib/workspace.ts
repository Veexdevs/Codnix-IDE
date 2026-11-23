// Materializa projetos em um diretorio de trabalho real no disco, usado pelo
// terminal e pelo preview. Depois de comandos, sincroniza alteracoes de volta
// para o storage (Supabase ou FS), mantendo tudo consistente.
import 'server-only';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { getProject, saveProject } from './storage';
import type { Project, StoredFile } from '@/types';

const WORKSPACES = process.env.CODNIX_WORKSPACES_DIR || path.join(os.tmpdir(), 'codnix-workspaces');

export function workspaceDir(projectId: string): string {
  return path.join(WORKSPACES, projectId);
}

interface SyncState {
  snapshot: Record<string, string>; // path -> content no ultimo sync
  lastSync: number;
}
const syncStates = new Map<string, SyncState>();

function walk(dir: string, base: string, out: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (['node_modules', '.git', '__pycache__', 'bin', 'dist', 'build', 'out', '.next'].includes(e.name)) continue;
    const full = path.join(dir, e.name);
    const rel = path.relative(base, full).replace(/\\/g, '/');
    if (e.isDirectory()) walk(full, base, out);
    else out.push(rel);
  }
  return out;
}

export function statWorkspace(projectId: string): boolean {
  try {
    return fs.existsSync(workspaceDir(projectId));
  } catch {
    return false;
  }
}

/** Escreve os arquivos do projeto no disco. Retorna o diretorio. */
export async function materialize(project: Project, force = false): Promise<string> {
  const dir = workspaceDir(project.id);
  if (fs.existsSync(dir)) {
    if (!force) return dir;
    await fsp.rm(dir, { recursive: true, force: true });
  }
  await fsp.mkdir(dir, { recursive: true });
  const snapshot: Record<string, string> = {};
  for (const [p, f] of Object.entries(project.files || {})) {
    const safe = p.replace(/\\/g, '/').split('/').filter((s) => s && s !== '.' && s !== '..').join('/');
    if (!safe) continue;
    const full = path.join(dir, safe);
    await fsp.mkdir(path.dirname(full), { recursive: true });
    await fsp.writeFile(full, f.content, 'utf8');
    snapshot[safe] = f.content;
  }
  syncStates.set(project.id, { snapshot, lastSync: Date.now() });
  return dir;
}

/** Garante workspace materializado (para preview/terminal). */
export async function ensureWorkspace(projectId: string): Promise<string | null> {
  const project = await getProject(projectId);
  if (!project) return null;
  return materialize(project);
}

/** Le um arquivo do workspace (preview). */
export function readWorkspaceFile(projectId: string, relPath: string): string | null {
  const dir = workspaceDir(projectId);
  const safe = relPath.replace(/\\/g, '/').split('/').filter((s) => s && s !== '.' && s !== '..').join('/');
  if (!safe) return null;
  const full = path.join(dir, safe);
  try {
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return null;
    return fs.readFileSync(full, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Compara o diretorio de trabalho com o ultimo snapshot e grava no storage
 * somente o que mudou. Retorna {changed, added, removed}.
 */
export async function syncBack(projectId: string): Promise<{ changed: string[]; added: string[]; removed: string[] }> {
  const dir = workspaceDir(projectId);
  if (!fs.existsSync(dir)) return { changed: [], added: [], removed: [] };
  const state = syncStates.get(projectId) || { snapshot: {}, lastSync: 0 };
  const project = await getProject(projectId);
  if (!project) return { changed: [], added: [], removed: [] };

  const rels = walk(dir, dir);
  const files: Record<string, StoredFile> = { ...project.files };
  const changed: string[] = [];
  const added: string[] = [];

  for (const rel of rels) {
    const full = path.join(dir, rel);
    let content: string;
    try {
      const st = fs.statSync(full);
      if (st.size > 800 * 1024) continue; // ignora arquivos grandes (binarios/build)
      content = fs.readFileSync(full, 'utf8');
    } catch {
      continue;
    }
    if (state.snapshot[rel] === undefined) {
      added.push(rel);
      files[rel] = { content, updated_at: new Date().toISOString() };
    } else if (state.snapshot[rel] !== content) {
      changed.push(rel);
      files[rel] = { content, updated_at: new Date().toISOString() };
    }
    state.snapshot[rel] = content;
  }

  const removed: string[] = [];
  for (const rel of Object.keys(state.snapshot)) {
    if (!rels.includes(rel)) {
      removed.push(rel);
      delete files[rel];
      delete state.snapshot[rel];
    }
  }

  if (changed.length || added.length || removed.length) {
    project.files = files;
    project.updated_at = new Date().toISOString();
    project.metadata = {
      ...project.metadata,
      history: [...(project.metadata?.history || []).slice(-49), {
        at: new Date().toISOString(),
        action: 'terminal_sync',
        detail: `+${added.length} ~${changed.length} -${removed.length}`,
      }],
    };
    await saveProject(project);
  }
  syncStates.set(projectId, state);
  return { changed, added, removed };
}
