// Camada de persistencia do CODNIX IDE.
// - Se SUPABASE_URL/SUPABASE_API_KEY estiverem definidos: Supabase Postgres (deploy Vercel).
// - Em caso de falha do Supabase: fallback automatico para arquivos locais (data/).
// - Sem Supabase: arquivos locais (desenvolvimento/desktop), diretorio data/.
import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import { supabaseConfigured, supaRest } from './supabase-rest';
import type { Conversation, Project } from '@/types';

const DATA_DIR = process.env.CODNIX_DATA_DIR || path.join(process.cwd(), 'data');

const projectsDir = () => path.join(DATA_DIR, 'projects');
const chatsDir = () => path.join(DATA_DIR, 'chats');
const settingsFile = () => path.join(DATA_DIR, 'settings.json');

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

type Meta = {
  id: string;
  name: string;
  description: string;
  template: string;
  favorite: boolean;
  fileCount: number;
  created_at: string;
  updated_at: string;
  modelsUsed?: string[];
};

function metaOf(p: Project): Meta {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    template: p.template,
    favorite: p.favorite,
    fileCount: Object.keys(p.files || {}).length,
    created_at: p.created_at,
    updated_at: p.updated_at,
    modelsUsed: p.metadata?.modelsUsed || [],
  };
}

// ---------------- FS helpers ----------------
async function fsReadJson<T>(file: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

const fsProjectPath = (id: string) => path.join(projectsDir(), `${id}.json`);
const fsChatPath = (id: string) => path.join(chatsDir(), `${id}.json`);

// ---------------- FS impl ----------------
const fsImpl = {
  async listProjects(): Promise<Meta[]> {
    await ensureDir(projectsDir());
    const names = await fs.readdir(projectsDir());
    const metas: Meta[] = [];
    for (const n of names.filter((n) => n.endsWith('.json'))) {
      const p = await fsReadJson<Project>(path.join(projectsDir(), n));
      if (p) metas.push(metaOf(p));
    }
    metas.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
    return metas;
  },
  async getProject(id: string): Promise<Project | null> {
    return fsReadJson<Project>(fsProjectPath(id));
  },
  async saveProject(p: Project): Promise<void> {
    await ensureDir(projectsDir());
    await fs.writeFile(fsProjectPath(p.id), JSON.stringify(p), 'utf8');
  },
  async deleteProject(id: string): Promise<void> {
    try {
      await fs.unlink(fsProjectPath(id));
    } catch {
      /* ignore */
    }
  },
  async getSetting<T>(key: string): Promise<T | null> {
    const all = (await fsReadJson<Record<string, unknown>>(settingsFile())) || {};
    return (all[key] as T) ?? null;
  },
  async setSetting(key: string, value: unknown): Promise<void> {
    await ensureDir(path.dirname(settingsFile()));
    const all = (await fsReadJson<Record<string, unknown>>(settingsFile())) || {};
    all[key] = value;
    await fs.writeFile(settingsFile(), JSON.stringify(all), 'utf8');
  },
  async deleteSetting(key: string): Promise<void> {
    const all = (await fsReadJson<Record<string, unknown>>(settingsFile())) || {};
    delete all[key];
    await fs.writeFile(settingsFile(), JSON.stringify(all), 'utf8');
  },
  async listConversations(): Promise<Conversation[]> {
    await ensureDir(chatsDir());
    const names = await fs.readdir(chatsDir());
    const convs: Conversation[] = [];
    for (const n of names.filter((n) => n.endsWith('.json'))) {
      const c = await fsReadJson<Conversation>(path.join(chatsDir(), n));
      if (c) convs.push(c);
    }
    convs.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    return convs;
  },
  async saveConversation(c: Conversation): Promise<void> {
    await ensureDir(chatsDir());
    await fs.writeFile(fsChatPath(c.id), JSON.stringify({ ...c, messages: c.messages.map((m) => ({ ...m, streaming: false })) }), 'utf8');
  },
  async deleteConversation(id: string): Promise<void> {
    try {
      await fs.unlink(fsChatPath(id));
    } catch {
      /* ignore */
    }
  },
};

// ---------------- Supabase impl ----------------
function rowToProject(row: Record<string, unknown>): Project {
  return {
    id: String(row.id),
    name: String(row.name || ''),
    description: String(row.description || ''),
    template: String(row.template || ''),
    favorite: Boolean(row.favorite),
    files: (row.files as Project['files']) || {},
    metadata: (row.metadata as Project['metadata']) || {},
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || ''),
  };
}

const sbImpl = {
  async listProjects(): Promise<Meta[]> {
    const rows = await supaRest<Record<string, unknown>[]>('codnix_projects', {
      query: { order: 'updated_at', asc: 'false', limit: '200' },
    });
    return (rows || []).map((r) => metaOf(rowToProject(r)));
  },
  async getProject(id: string): Promise<Project | null> {
    const rows = await supaRest<Record<string, unknown>[]>('codnix_projects', {
      query: { id: `eq.${id}`, limit: '1' },
    });
    return rows && rows[0] ? rowToProject(rows[0]) : null;
  },
  async saveProject(p: Project): Promise<void> {
    await supaRest('codnix_projects', {
      method: 'POST',
      body: {
        id: p.id,
        name: p.name,
        description: p.description,
        template: p.template,
        favorite: p.favorite,
        files: p.files,
        metadata: p.metadata || {},
        updated_at: p.updated_at,
        created_at: p.created_at,
      },
      prefer: 'resolution=merge-duplicates',
    });
  },
  async deleteProject(id: string): Promise<void> {
    await supaRest('codnix_projects', { method: 'DELETE', query: { id: `eq.${id}` } });
    await supaRest('codnix_chats', { method: 'DELETE', query: { project_id: `eq.${id}` } });
  },
  async getSetting<T>(key: string): Promise<T | null> {
    const rows = await supaRest<{ value: T }[]>('codnix_settings', {
      query: { key: `eq.${key}`, limit: '1' },
    });
    return rows && rows[0] ? rows[0].value : null;
  },
  async setSetting(key: string, value: unknown): Promise<void> {
    await supaRest('codnix_settings', {
      method: 'POST',
      body: { key, value, updated_at: new Date().toISOString() },
      prefer: 'resolution=merge-duplicates',
    });
  },
  async deleteSetting(key: string): Promise<void> {
    await supaRest('codnix_settings', { method: 'DELETE', query: { key: `eq.${key}` } });
  },
  async listConversations(): Promise<Conversation[]> {
    const rows = await supaRest<Record<string, unknown>[]>('codnix_chats', {
      query: { order: 'updated_at', asc: 'false', limit: '100' },
    });
    return (rows || []).map(rowToConversation);
  },
  async saveConversation(c: Conversation): Promise<void> {
    await supaRest('codnix_chats', {
      method: 'POST',
      body: {
        id: c.id,
        title: c.title,
        model: c.model,
        mode: c.mode,
        project_id: c.projectId ?? null,
        messages: c.messages.map((m) => ({ ...m, streaming: false })),
        created_at: c.createdAt,
        updated_at: c.updatedAt,
      },
      prefer: 'resolution=merge-duplicates',
    });
  },
  async deleteConversation(id: string): Promise<void> {
    await supaRest('codnix_chats', { method: 'DELETE', query: { id: `eq.${id}` } });
  },
};

function rowToConversation(row: Record<string, unknown>): Conversation {
  return {
    id: String(row.id),
    title: String(row.title || 'Nova conversa'),
    model: String(row.model || ''),
    mode: (row.mode as Conversation['mode']) || 'individual',
    projectId: row.project_id ? String(row.project_id) : undefined,
    messages: (row.messages as Conversation['messages']) || [],
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}

// ---------------- API publica com fallback ----------------
export function storageMode(): 'supabase' | 'fs' {
  return supabaseConfigured() ? 'supabase' : 'fs';
}

export function storageModeLive(): 'supabase' | 'fs' {
  return storageMode();
}

async function withFallback<T>(op: () => Promise<T>, fallback: () => Promise<T>, label: string): Promise<T> {
  if (!supabaseConfigured()) return fallback();
  try {
    return await op();
  } catch (e) {
    console.error(`[storage] Supabase falhou em "${label}", usando FS local:`, e instanceof Error ? e.message : e);
    return fallback();
  }
}

export async function listProjects(): Promise<Meta[]> {
  return withFallback(() => sbImpl.listProjects(), () => fsImpl.listProjects(), 'listProjects');
}

export async function getProject(id: string): Promise<Project | null> {
  if (!/^[\w-]+$/.test(id)) return null;
  return withFallback(() => sbImpl.getProject(id), () => fsImpl.getProject(id), 'getProject');
}

export async function saveProject(p: Project): Promise<void> {
  return withFallback(() => sbImpl.saveProject(p), () => fsImpl.saveProject(p), 'saveProject');
}

export async function deleteProject(id: string): Promise<void> {
  return withFallback(() => sbImpl.deleteProject(id), () => fsImpl.deleteProject(id), 'deleteProject');
}

export async function getSetting<T = unknown>(key: string): Promise<T | null> {
  return withFallback(() => sbImpl.getSetting<T>(key), () => fsImpl.getSetting<T>(key), 'getSetting');
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  return withFallback(() => sbImpl.setSetting(key, value), () => fsImpl.setSetting(key, value), 'setSetting');
}

export async function deleteSetting(key: string): Promise<void> {
  return withFallback(() => sbImpl.deleteSetting(key), () => fsImpl.deleteSetting(key), 'deleteSetting');
}

export async function listConversations(): Promise<Conversation[]> {
  return withFallback(() => sbImpl.listConversations(), () => fsImpl.listConversations(), 'listConversations');
}

export async function saveConversation(c: Conversation): Promise<void> {
  return withFallback(() => sbImpl.saveConversation(c), () => fsImpl.saveConversation(c), 'saveConversation');
}

export async function deleteConversation(id: string): Promise<void> {
  if (!/^[\w-]+$/.test(id)) return;
  return withFallback(() => sbImpl.deleteConversation(id), () => fsImpl.deleteConversation(id), 'deleteConversation');
}
