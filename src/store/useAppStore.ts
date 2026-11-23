'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiJson } from '@/lib/api-client';
import { nowIso, uid } from '@/lib/utils';
import { useSettings } from './useSettingsStore';
import type { Project } from '@/types';

export interface TerminalLine {
  id: string;
  text: string;
  kind: 'in' | 'out' | 'err' | 'ok' | 'sys';
}
export interface OutputLine {
  id: string;
  at: string;
  text: string;
  kind: 'info' | 'warn' | 'err' | 'ok';
}
export interface EditorMarker {
  path: string;
  line: number;
  col: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

interface AppStore {
  projectId: string | null;
  project: Project | null;
  loadingProject: boolean;
  loadError: string | null;
  files: Record<string, string>;
  savedFiles: Record<string, string>; // ultima versao salva (para detectar dirty)
  openTabs: string[];
  activeTab: string | null;
  fileVersions: Record<string, { content: string; at: string }[]>;
  markers: EditorMarker[];
  cursor: { line: number; col: number };
  terminalLines: TerminalLine[];
  terminalSessionId: string | null;
  terminalCwd: string;
  terminalRunning: boolean;
  commandHistory: string[];
  outputLines: OutputLine[];
  consoleLines: OutputLine[];
  revealRequest: { path: string; line: number; nonce: number } | null;
  lastModelsUsed: string[];

  setCursor(line: number, col: number): void;
  setMarkers(markers: EditorMarker[]): void;
  addOutput(text: string, kind?: OutputLine['kind']): void;
  addConsole(text: string, kind?: OutputLine['kind']): void;
  requestReveal(path: string, line: number): void;
  addTerminalLine(text: string, kind: TerminalLine['kind']): void;
  clearTerminal(): void;
  clearConsole(): void;

  openTab(path: string): void;
  closeTab(path: string): void;
  setActiveTab(path: string | null): void;
  openFile(path: string): Promise<void>;

  loadProject(id: string): Promise<void>;
  createProject(name: string, template: string, description?: string): Promise<Project | null>;
  updateFileContent(path: string, content: string): void;
  saveFile(path?: string): Promise<boolean>;
  saveAllFiles(): Promise<void>;
  createFile(path: string, content?: string): Promise<boolean>;
  createFolder(folder: string): Promise<boolean>;
  deleteFile(path: string): Promise<boolean>;
  renameFile(from: string, to: string): Promise<boolean>;
  restoreVersion(path: string, index: number): Promise<void>;

  ensureTerminalSession(): Promise<string | null>;
  runCommand(cmd: string): Promise<{ output: string; exitCode: number } | null>;
  disposeTerminal(): Promise<void>;
}

const autosaveTimers: Record<string, number> = {};

export const useApp = create<AppStore>()(
  persist(
    (set, get) => ({
      projectId: null,
      project: null,
      loadingProject: false,
      loadError: null,
      files: {},
      savedFiles: {},
      openTabs: [],
      activeTab: null,
      fileVersions: {},
      markers: [],
      cursor: { line: 1, col: 1 },
      terminalLines: [],
      terminalSessionId: null,
      terminalCwd: '.',
      terminalRunning: false,
      commandHistory: [],
      outputLines: [],
      consoleLines: [],
      revealRequest: null,
      lastModelsUsed: [],

      setCursor: (line, col) => set({ cursor: { line, col } }),
      setMarkers: (markers) => set({ markers }),
      addOutput: (text, kind = 'info') =>
        set({ outputLines: [...get().outputLines.slice(-299), { id: uid(), at: nowIso(), text, kind }] }),
      addConsole: (text, kind = 'info') =>
        set({ consoleLines: [...get().consoleLines.slice(-299), { id: uid(), at: nowIso(), text, kind }] }),
      requestReveal: (path, line) => set({ revealRequest: { path, line, nonce: Date.now() } }),
      addTerminalLine: (text, kind) =>
        set({ terminalLines: [...get().terminalLines.slice(-999), { id: uid(), text, kind }] }),
      clearTerminal: () => set({ terminalLines: [] }),
      clearConsole: () => set({ consoleLines: [] }),

      openTab: (path) => {
        const tabs = get().openTabs;
        if (!tabs.includes(path)) set({ openTabs: [...tabs, path] });
        set({ activeTab: path });
      },
      closeTab: (path) => {
        const tabs = get().openTabs.filter((t) => t !== path);
        const active = get().activeTab;
        set({
          openTabs: tabs,
          activeTab: active === path ? tabs[tabs.length - 1] || null : active,
        });
      },
      setActiveTab: (path) => set({ activeTab: path }),

      openFile: async (path) => {
        const { files } = get();
        if (!(path in files)) {
          try {
            const res = await apiJson<{ content: string }>(`/api/projects/${get().projectId}/files?path=${encodeURIComponent(path)}`);
            set({ files: { ...get().files, [path]: res.content }, savedFiles: { ...get().savedFiles, [path]: res.content } });
          } catch (e) {
            get().addOutput(`Falha ao abrir ${path}: ${(e as Error).message}`, 'err');
            return;
          }
        }
        get().openTab(path);
      },

      loadProject: async (id) => {
        set({ loadingProject: true, loadError: null });
        try {
          const res = await apiJson<{ project: Project }>(`/api/projects/${id}`);
          const project = res.project;
          const files: Record<string, string> = {};
          const saved: Record<string, string> = {};
          for (const [p, f] of Object.entries(project.files)) {
            files[p] = f.content;
            saved[p] = f.content;
          }
          set({
            projectId: id,
            project,
            files,
            savedFiles: saved,
            loadingProject: false,
            fileVersions: {},
            markers: [],
            terminalSessionId: null,
          });
          // abre um arquivo inicial
          const first = Object.keys(files).sort((a, b) => {
            const sa = a.includes('main') || a.includes('index') ? 0 : 1;
            const sb = b.includes('main') || b.includes('index') ? 0 : 1;
            return sa - sb || a.localeCompare(b);
          })[0];
          if (first) {
            set({ openTabs: [first], activeTab: first });
          }
          get().addOutput(`Projeto "${project.name}" carregado (${Object.keys(files).length} arquivos).`, 'ok');
        } catch (e) {
          set({ loadingProject: false, loadError: (e as Error).message });
        }
      },

      createProject: async (name, template, description) => {
        try {
          const res = await apiJson<{ project: Project }>('/api/projects', {
            method: 'POST',
            body: JSON.stringify({ name, template, description }),
          });
          set({ lastModelsUsed: get().lastModelsUsed });
          return res.project;
        } catch (e) {
          get().addOutput(`Falha ao criar projeto: ${(e as Error).message}`, 'err');
          return null;
        }
      },

      updateFileContent: (path, content) => {
        set({ files: { ...get().files, [path]: content } });
        const editor = useSettings.getState().editor;
        if (editor?.autoSave) {
          window.clearTimeout(autosaveTimers[path]);
          autosaveTimers[path] = window.setTimeout(() => {
            void get().saveFile(path);
          }, editor.autoSaveDelay || 1000) as unknown as number;
        }
      },

      saveFile: async (path) => {
        const p = path || get().activeTab;
        if (!p || !get().projectId) return false;
        const content = get().files[p];
        if (content === undefined) return false;
        if (get().savedFiles[p] === content) return true;
        try {
          await apiJson(`/api/projects/${get().projectId}/files`, {
            method: 'PUT',
            body: JSON.stringify({ path: p, content }),
          });
          const versions = get().fileVersions[p] || [];
          set({
            savedFiles: { ...get().savedFiles, [p]: content },
            fileVersions: {
              ...get().fileVersions,
              [p]: [...versions.slice(-19), { content: get().savedFiles[p] ?? content, at: nowIso() }],
            },
          });
          return true;
        } catch (e) {
          get().addOutput(`Falha ao salvar ${p}: ${(e as Error).message}`, 'err');
          return false;
        }
      },

      saveAllFiles: async () => {
        const { files, savedFiles } = get();
        for (const p of Object.keys(files)) {
          if (files[p] !== savedFiles[p]) await get().saveFile(p);
        }
      },

      createFile: async (path, content = '') => {
        if (!get().projectId) return false;
        try {
          await apiJson(`/api/projects/${get().projectId}/files`, {
            method: 'PUT',
            body: JSON.stringify({ path, content }),
          });
          set({ files: { ...get().files, [path]: content }, savedFiles: { ...get().savedFiles, [path]: content } });
          get().openTab(path);
          get().addOutput(`Arquivo criado: ${path}`, 'ok');
          return true;
        } catch (e) {
          get().addOutput(`Falha ao criar ${path}: ${(e as Error).message}`, 'err');
          return false;
        }
      },

      createFolder: async (folder) => {
        return get().createFile(`${folder.replace(/\/$/, '')}/.gitkeep`, '');
      },

      deleteFile: async (path) => {
        if (!get().projectId) return false;
        try {
          await apiJson(`/api/projects/${get().projectId}/files?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
          const files = { ...get().files };
          const saved = { ...get().savedFiles };
          delete files[path];
          delete saved[path];
          set({ files, savedFiles: saved });
          get().closeTab(path);
          get().addOutput(`Arquivo excluído: ${path}`, 'ok');
          return true;
        } catch (e) {
          get().addOutput(`Falha ao excluir ${path}: ${(e as Error).message}`, 'err');
          return false;
        }
      },

      renameFile: async (from, to) => {
        if (!get().projectId) return false;
        try {
          await apiJson(`/api/projects/${get().projectId}/files`, {
            method: 'PATCH',
            body: JSON.stringify({ from, to }),
          });
          const files = { ...get().files };
          const saved = { ...get().savedFiles };
          const content = files[from];
          const savedContent = saved[from];
          delete files[from];
          delete saved[from];
          if (content !== undefined) files[to] = content;
          if (savedContent !== undefined) saved[to] = savedContent;
          const tabs = get().openTabs.map((t) => (t === from ? to : t));
          set({
            files,
            savedFiles: saved,
            openTabs: tabs,
            activeTab: get().activeTab === from ? to : get().activeTab,
          });
          get().addOutput(`Renomeado: ${from} → ${to}`, 'ok');
          return true;
        } catch (e) {
          get().addOutput(`Falha ao renomear ${from}: ${(e as Error).message}`, 'err');
          return false;
        }
      },

      restoreVersion: async (path, index) => {
        const versions = get().fileVersions[path];
        if (!versions || !versions[index]) return;
        const content = versions[index].content;
        set({ files: { ...get().files, [path]: content } });
        await get().saveFile(path);
        get().addOutput(`Versão restaurada em ${path} (${versions[index].at}).`, 'ok');
      },

      ensureTerminalSession: async () => {
        const existing = get().terminalSessionId;
        if (existing) return existing;
        const projectId = get().projectId;
        if (!projectId) return null;
        try {
          const res = await apiJson<{ sessionId: string }>('/api/terminal', {
            method: 'POST',
            body: JSON.stringify({ action: 'create', projectId }),
          });
          set({ terminalSessionId: res.sessionId, terminalCwd: '.' });
          return res.sessionId;
        } catch (e) {
          get().addTerminalLine(`[CODNIX] Falha ao criar sessão: ${(e as Error).message}`, 'err');
          return null;
        }
      },

      runCommand: async (cmd) => {
        const projectId = get().projectId;
        if (!projectId) {
          get().addTerminalLine('[CODNIX] Abra um projeto para usar o terminal.', 'err');
          return null;
        }
        set({ terminalRunning: true });
        get().addTerminalLine(`$ ${cmd}`, 'in');
        set({ commandHistory: [...get().commandHistory.slice(-99), cmd] });
        try {
          let sessionId = await get().ensureTerminalSession();
          if (!sessionId) return null;
          const shell = 'bash';
          let res = await apiJson<{ output: string; exitCode: number; cwd: string }>('/api/terminal', {
            method: 'POST',
            body: JSON.stringify({ action: 'exec', projectId, sessionId, command: cmd, shell }),
          });
          if (!res) throw new Error('sem resposta');
          set({ terminalRunning: false, terminalCwd: res.cwd });
          return { output: res.output, exitCode: res.exitCode };
        } catch (e) {
          const err = e as Error & { code?: string };
          set({ terminalRunning: false });
          if (err.code === 'SESSION_NOT_FOUND') {
            set({ terminalSessionId: null });
            get().addTerminalLine('[CODNIX] Sessão expirada — recriando...', 'sys');
            set({ terminalSessionId: null });
            const retry = await get().runCommand(cmd);
            return retry;
          }
          get().addTerminalLine(`[CODNIX] Erro: ${err.message}`, 'err');
          return { output: err.message, exitCode: 1 };
        }
      },

      disposeTerminal: async () => {
        const id = get().terminalSessionId;
        if (!id) return;
        try {
          await apiJson('/api/terminal', { method: 'POST', body: JSON.stringify({ action: 'dispose', sessionId: id }) });
        } catch { /* ignore */ }
        set({ terminalSessionId: null, terminalLines: [] });
      },
    }),
    {
      name: 'codnix-app',
      partialize: (s) => ({ projectId: s.projectId, openTabs: s.openTabs, activeTab: s.activeTab, lastModelsUsed: s.lastModelsUsed }),
    }
  )
);

