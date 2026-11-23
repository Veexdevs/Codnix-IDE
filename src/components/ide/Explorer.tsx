'use client';

import { useMemo, useState } from 'react';
import {
  ChevronDown, ChevronRight, File as FileIcon, FilePlus2, Folder, FolderOpen,
  FolderPlus, MoreVertical, Pencil, RefreshCw, Trash2,
} from 'lucide-react';
import { useApp } from '@/store/useAppStore';
import { baseName, fileExt } from '@/lib/utils';
import { languageFor } from '@/lib/languages';

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children: TreeNode[];
}

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', type: 'dir', children: [] };
  for (const p of paths) {
    const parts = p.split('/');
    let cur = root;
    for (let i = 0; i < parts.length; i++) {
      const isFile = i === parts.length - 1;
      const path = parts.slice(0, i + 1).join('/');
      let next = cur.children.find((c) => c.name === parts[i] && (isFile ? c.type === 'file' : c.type === 'dir'));
      if (!next) {
        next = { name: parts[i], path, type: isFile ? 'file' : 'dir', children: [] };
        cur.children.push(next);
      }
      cur = next;
    }
  }
  const sortRec = (n: TreeNode) => {
    n.children.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
    n.children.forEach(sortRec);
  };
  sortRec(root);
  return root.children;
}

function extColor(path: string): string {
  const lang = languageFor(path);
  switch (lang.monaco) {
    case 'javascript': return '#e8d44d';
    case 'typescript': return '#3178c6';
    case 'html': return '#e34c26';
    case 'css': return '#563d7c';
    case 'python': return '#3572A5';
    case 'cpp': return '#f34b7d';
    case 'c': return '#555555';
    case 'json': return '#cbcb41';
    case 'markdown': return '#9d9da4';
    default: return '#9d9da4';
  }
}

export default function Explorer({ onAction }: { onAction?: (msg: string) => void }) {
  const { project, files, openTabs, activeTab, openFile, deleteFile, renameFile, createFile, createFolder } = useApp();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [newItem, setNewItem] = useState<{ kind: 'file' | 'folder'; dir: string } | null>(null);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<{ path: string; name: string } | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [fileSearch, setFileSearch] = useState('');

  const paths = useMemo(() => Object.keys(files).filter((p) => !p.endsWith('.gitkeep')).sort(), [files]);
  const tree = useMemo(() => buildTree(paths), [paths]);

  const dirty = (path: string) => files[path] !== undefined && useApp.getState().savedFiles[path] !== files[path];

  const toggle = (path: string) => setCollapsed((c) => ({ ...c, [path]: !c[path] }));

  const renderNode = (node: TreeNode, depth: number): React.ReactNode => {
    const isCollapsed = collapsed[node.path] ?? false;
    const isActive = activeTab === node.path;
    const isDirty = node.type === 'file' && dirty(node.path);

    if (fileSearch && node.type === 'dir' && !paths.some((p) => p.startsWith(node.path) && p.toLowerCase().includes(fileSearch.toLowerCase()))) {
      return null;
    }

    return (
      <div key={node.path}>
        <div
          className={`group flex cursor-pointer items-center gap-1 rounded px-1.5 py-[3px] text-xs hover:bg-panel-3 ${isActive ? 'bg-accent-soft text-ink' : 'text-ink-2'}`}
          style={{ paddingLeft: depth * 12 + 6 }}
          onClick={() => (node.type === 'dir' ? toggle(node.path) : void openFile(node.path))}
        >
          {node.type === 'dir' ? (
            <>
              {isCollapsed ? <ChevronRight size={12} className="shrink-0 text-ink-3" /> : <ChevronDown size={12} className="shrink-0 text-ink-3" />}
              {isCollapsed ? <Folder size={13} className="shrink-0 text-ink-3" /> : <FolderOpen size={13} className="shrink-0 text-ink-3" />}
            </>
          ) : (
            <>
              <span className="w-[12px] shrink-0" />
              <FileIcon size={13} className="shrink-0" style={{ color: extColor(node.path) }} />
            </>
          )}
          {renaming?.path === node.path ? (
            <input
              autoFocus
              className="w-full rounded border accent-border bg-panel px-1 text-xs text-ink outline-none"
              value={renaming.name}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setRenaming({ path: node.path, name: e.target.value })}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && renaming) {
                  const parent = node.path.split('/').slice(0, -1).join('/');
                  const to = parent ? `${parent}/${renaming.name}` : renaming.name;
                  if (to !== node.path && renaming.name.trim()) {
                    await renameFile(node.path, to);
                  }
                  setRenaming(null);
                }
                if (e.key === 'Escape') setRenaming(null);
              }}
              onBlur={() => setRenaming(null)}
            />
          ) : (
            <span className={`min-w-0 flex-1 truncate ${isDirty ? 'text-warn' : ''}`}>
              {node.name}
              {isDirty && ' ●'}
            </span>
          )}
          <button
            className="hidden shrink-0 rounded p-0.5 text-ink-3 hover:text-ink group-hover:block"
            onClick={(e) => {
              e.stopPropagation();
              setMenuFor(menuFor === node.path ? null : node.path);
            }}
          >
            <MoreVertical size={12} />
          </button>
        </div>

        {menuFor === node.path && (
          <div className="context-menu" style={{ left: 'auto', marginLeft: depth * 12 + 24, marginTop: -22 }} onMouseLeave={() => setMenuFor(null)}>
            {node.type === 'dir' && (
              <>
                <button className="context-menu-item" onClick={() => { setNewItem({ kind: 'file', dir: node.path }); setNewName(''); setMenuFor(null); }}>
                  <FilePlus2 size={12} /> Novo arquivo
                </button>
                <button className="context-menu-item" onClick={() => { setNewItem({ kind: 'folder', dir: node.path }); setNewName(''); setMenuFor(null); }}>
                  <FolderPlus size={12} /> Nova pasta
                </button>
              </>
            )}
            <button className="context-menu-item" onClick={() => { setRenaming({ path: node.path, name: node.name }); setMenuFor(null); }}>
              <Pencil size={12} /> Renomear
            </button>
            <button
              className="context-menu-item text-err"
              onClick={async () => {
                setMenuFor(null);
                if (confirm(`Excluir "${node.path}"?`)) await deleteFile(node.path);
              }}
            >
              <Trash2 size={12} /> Excluir
            </button>
          </div>
        )}

        {node.type === 'dir' && !isCollapsed && node.children.map((c) => renderNode(c, depth + 1))}
        {node.type === 'dir' && !isCollapsed && newItem?.dir === node.path && (
          <input
            autoFocus
            className="mx-2 my-0.5 w-[calc(100%-24px)] rounded border accent-border bg-panel px-1.5 py-0.5 text-xs text-ink outline-none"
            placeholder={newItem.kind === 'file' ? 'nome do arquivo.ext' : 'nome da pasta'}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === 'Enter' && newName.trim()) {
                const full = `${node.path}/${newName.trim()}`;
                if (newItem.kind === 'file') await createFile(full, '');
                else await createFolder(full);
                setNewItem(null);
                setNewName('');
              }
              if (e.key === 'Escape') setNewItem(null);
            }}
            onBlur={() => setNewItem(null)}
          />
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="codnix-panel-title">Explorer</span>
        <div className="flex items-center gap-1">
          <button className="rounded p-1 text-ink-3 hover:text-ink" title="Novo arquivo" onClick={() => { setNewItem({ kind: 'file', dir: '' }); setNewName(''); }}>
            <FilePlus2 size={13} />
          </button>
          <button className="rounded p-1 text-ink-3 hover:text-ink" title="Nova pasta" onClick={() => { setNewItem({ kind: 'folder', dir: '' }); setNewName(''); }}>
            <FolderPlus size={13} />
          </button>
        </div>
      </div>

      <div className="px-3 pb-2">
        <input
          className="codnix-input py-1 text-2xs"
          placeholder="Filtrar arquivos..."
          value={fileSearch}
          onChange={(e) => setFileSearch(e.target.value)}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
        <div className="mb-1 flex items-center gap-1.5 px-1.5 text-xs font-semibold text-ink">
          <FolderOpen size={13} className="accent-text" />
          {project?.name || 'Projeto'}
        </div>

        {newItem && newItem.dir === '' && (
          <input
            autoFocus
            className="mx-1.5 my-1 w-[calc(100%-12px)] rounded border accent-border bg-panel px-1.5 py-1 text-xs text-ink outline-none"
            placeholder={newItem.kind === 'file' ? 'caminho/arquivo.ext' : 'caminho/pasta'}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === 'Enter' && newName.trim()) {
                if (newItem.kind === 'file') await createFile(newName.trim(), '');
                else await createFolder(newName.trim());
                setNewItem(null);
                setNewName('');
              }
              if (e.key === 'Escape') setNewItem(null);
            }}
            onBlur={() => setNewItem(null)}
          />
        )}

        {tree.map((n) => renderNode(n, 1))}
        {paths.length === 0 && (
          <p className="px-2 py-4 text-center text-2xs text-ink-3">
            Nenhum arquivo. Crie o primeiro com o botão + acima.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-edge px-3 py-1.5 text-2xs text-ink-3">
        <span>{paths.length} arquivos</span>
        <span>{openTabs.length} abas</span>
      </div>
    </div>
  );
}
