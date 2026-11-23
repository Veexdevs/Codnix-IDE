export interface StoredFile {
  content: string;
  updated_at: string;
}

export interface ProjectIndex {
  builtAt?: string;
  outline?: string;
  fileCount?: number;
  totalChars?: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  template: string;
  favorite: boolean;
  files: Record<string, StoredFile>;
  metadata: {
    modelsUsed?: string[];
    index?: ProjectIndex;
    history?: { at: string; action: string; detail?: string }[];
  };
  created_at: string;
  updated_at: string;
}

export interface ProjectMeta {
  id: string;
  name: string;
  description: string;
  template: string;
  favorite: boolean;
  fileCount: number;
  created_at: string;
  updated_at: string;
  modelsUsed?: string[];
}

export interface ChatAttachment {
  path: string;
  name: string;
  content: string;
}

export interface FileAction {
  type: 'create_file' | 'edit_file' | 'delete_file' | 'run_command';
  path?: string;
  content?: string;
  find?: string;
  replace?: string;
  command?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  createdAt: string;
  streaming?: boolean;
  error?: string;
  errorCode?: string;
  attachments?: ChatAttachment[];
  actions?: FileAction[];
  agentLabel?: string;
  elapsedMs?: number;
}

export type ChatMode = 'individual' | 'team' | 'comparison' | 'developer' | 'review';

export interface Conversation {
  id: string;
  title: string;
  model: string;
  mode: ChatMode;
  projectId?: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ORModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  contextLength: number;
  imageInput: boolean;
  promptPrice: number;
  completionPrice: number;
  featured?: boolean;
}

export interface AgentConfig {
  id: string;
  role: string;
  roleKey: 'analyst' | 'planner' | 'implementer' | 'reviewer' | 'debugger' | 'consolidator' | 'custom';
  model: string;
  customInstruction?: string;
}

export interface DiffLine {
  type: 'ctx' | 'add' | 'del';
  text: string;
  oldLine?: number;
  newLine?: number;
}

export interface ProposedChange {
  id: string;
  action: FileAction;
  before?: string;
  after?: string;
  status: 'pending' | 'applied' | 'rejected' | 'error';
  error?: string;
}

export interface TerminalSessionInfo {
  id: string;
  projectId: string;
  created: boolean;
}
