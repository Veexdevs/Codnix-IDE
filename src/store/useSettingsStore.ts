'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AgentConfig } from '@/types';

export interface EditorPrefs {
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  autoSave: boolean;
  autoSaveDelay: number;
}

export interface CodnixSettings {
  favorites: string[];
  language: 'pt' | 'en';
  accent: 'blue' | 'violet' | 'green' | 'orange';
  editor: EditorPrefs;
  terminal: { shell: 'bash' | 'sh'; timeout: number };
  privacy: { sendContext: boolean; excludedDirs: string[] };
  agents: AgentConfig[];
  teamConsolidator: string;
  maxRequests: number;
  contextBudget: number;
  defaultModel: string;
}

export const DEFAULT_AGENTS: AgentConfig[] = [
  { id: 'a1', roleKey: 'analyst', role: 'Analista', model: '', customInstruction: '' },
  { id: 'a2', roleKey: 'planner', role: 'Planejador', model: '', customInstruction: '' },
  { id: 'a3', roleKey: 'reviewer', role: 'Revisor', model: '', customInstruction: '' },
  { id: 'a4', roleKey: 'debugger', role: 'Depurador', model: '', customInstruction: '' },
];

interface SettingsStore extends CodnixSettings {
  set<K extends keyof CodnixSettings>(key: K, value: CodnixSettings[K]): void;
  toggleFavorite(modelId: string): void;
  updateAgent(id: string, patch: Partial<AgentConfig>): void;
  addAgent(): void;
  removeAgent(id: string): void;
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set, get) => ({
      favorites: [],
      language: 'pt',
      accent: 'blue',
      editor: { fontSize: 14, tabSize: 4, wordWrap: false, minimap: true, autoSave: true, autoSaveDelay: 1000 },
      terminal: { shell: 'bash', timeout: 30000 },
      privacy: { sendContext: true, excludedDirs: ['node_modules', '.git', 'dist', 'build', 'bin', 'out', '__pycache__'] },
      agents: DEFAULT_AGENTS,
      teamConsolidator: '',
      maxRequests: 8,
      contextBudget: 24000,
      defaultModel: '',
      set: (key, value) => set({ [key]: value } as Partial<SettingsStore>),
      toggleFavorite: (modelId) => {
        const fav = get().favorites;
        set({ favorites: fav.includes(modelId) ? fav.filter((f) => f !== modelId) : [...fav, modelId] });
      },
      updateAgent: (id, patch) =>
        set({ agents: get().agents.map((a) => (a.id === id ? { ...a, ...patch } : a)) }),
      addAgent: () =>
        set({
          agents: [...get().agents, { id: `a${Date.now().toString(36)}`, roleKey: 'custom', role: 'Agente', model: '', customInstruction: '' }],
        }),
      removeAgent: (id) => set({ agents: get().agents.filter((a) => a.id !== id) }),
    }),
    { name: 'codnix-settings' }
  )
);
