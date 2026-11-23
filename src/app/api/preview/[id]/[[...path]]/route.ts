// Preview do projeto: serve arquivos do workspace para o iframe integrado.
import { NextRequest, NextResponse } from 'next/server';
import { ensureWorkspace, readWorkspaceFile, statWorkspace } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string; path?: string[] } };

const MIME: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  json: 'application/json',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  txt: 'text/plain; charset=utf-8',
  md: 'text/plain; charset=utf-8',
};

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id, path } = ctx.params;
  const rel = (path || ['index.html']).join('/') || 'index.html';
  if (!statWorkspace(id)) {
    const dir = await ensureWorkspace(id);
    if (!dir) return NextResponse.json({ ok: false, error: 'Projeto não encontrado' }, { status: 404 });
  }
  const content = readWorkspaceFile(id, rel);
  if (content === null) {
    // tenta index.html para rotas relativas
    const index = readWorkspaceFile(id, 'index.html');
    if (index !== null && !rel.includes('.')) {
      return new Response(index, { headers: { 'Content-Type': MIME.html } });
    }
    return new Response(`<!DOCTYPE html><body style="background:#111;color:#888;font-family:sans-serif;padding:2rem">Arquivo não encontrado: ${rel}</body>`, {
      status: 404,
      headers: { 'Content-Type': MIME.html },
    });
  }
  const ext = rel.split('.').pop()?.toLowerCase() || 'txt';
  return new Response(content, { headers: { 'Content-Type': MIME[ext] || 'application/octet-stream' } });
}
