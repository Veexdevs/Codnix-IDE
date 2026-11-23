// Operacoes de arquivos: leitura, criacao/escrita, exclusao, renomeacao.
import { NextRequest, NextResponse } from 'next/server';
import { getProject, saveProject } from '@/lib/storage';
import { nowIso, sanitizeRelPath } from '@/lib/utils';
import type { StoredFile } from '@/types';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };
const MAX_FILE = 800 * 1024;

export async function GET(req: NextRequest, ctx: Ctx) {
  const project = await getProject(ctx.params.id);
  if (!project) return NextResponse.json({ ok: false, error: 'Projeto não encontrado' }, { status: 404 });
  const path = req.nextUrl.searchParams.get('path');
  if (path) {
    const f = project.files[sanitizeRelPath(path)];
    if (!f) return NextResponse.json({ ok: false, error: 'Arquivo não encontrado' }, { status: 404 });
    return NextResponse.json({ ok: true, path: sanitizeRelPath(path), content: f.content, updated_at: f.updated_at });
  }
  const tree = Object.entries(project.files).map(([p, f]) => ({ path: p, updated_at: f.updated_at, size: f.content.length }));
  return NextResponse.json({ ok: true, files: tree });
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const project = await getProject(ctx.params.id);
  if (!project) return NextResponse.json({ ok: false, error: 'Projeto não encontrado' }, { status: 404 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.path !== 'string') {
    return NextResponse.json({ ok: false, error: 'Informe path' }, { status: 400 });
  }
  const p = sanitizeRelPath(body.path);
  if (!p) return NextResponse.json({ ok: false, error: 'Caminho inválido' }, { status: 400 });
  const content = typeof body.content === 'string' ? body.content : '';
  if (content.length > MAX_FILE) {
    return NextResponse.json({ ok: false, error: 'Arquivo muito grande (limite 800KB por arquivo)' }, { status: 413 });
  }
  const created = !project.files[p];
  project.files[p] = { content, updated_at: nowIso() } satisfies StoredFile;
  project.updated_at = nowIso();
  project.metadata = {
    ...project.metadata,
    history: [...(project.metadata?.history || []).slice(-99), {
      at: nowIso(),
      action: created ? 'file_create' : 'file_write',
      detail: p,
    }],
  };
  await saveProject(project);
  return NextResponse.json({ ok: true, path: p, created });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  // Renomear/mover arquivo
  const project = await getProject(ctx.params.id);
  if (!project) return NextResponse.json({ ok: false, error: 'Projeto não encontrado' }, { status: 404 });
  const body = await req.json().catch(() => null);
  const from = sanitizeRelPath(String(body?.from || ''));
  const to = sanitizeRelPath(String(body?.to || ''));
  if (!from || !to || !project.files[from]) {
    return NextResponse.json({ ok: false, error: 'Arquivo de origem não encontrado' }, { status: 404 });
  }
  const f = project.files[from];
  delete project.files[from];
  project.files[to] = f;
  project.updated_at = nowIso();
  project.metadata = {
    ...project.metadata,
    history: [...(project.metadata?.history || []).slice(-99), { at: nowIso(), action: 'file_rename', detail: `${from} → ${to}` }],
  };
  await saveProject(project);
  return NextResponse.json({ ok: true, from, to });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const project = await getProject(ctx.params.id);
  if (!project) return NextResponse.json({ ok: false, error: 'Projeto não encontrado' }, { status: 404 });
  const path = req.nextUrl.searchParams.get('path');
  const p = sanitizeRelPath(path || '');
  if (!p || !project.files[p]) {
    return NextResponse.json({ ok: false, error: 'Arquivo não encontrado' }, { status: 404 });
  }
  delete project.files[p];
  project.updated_at = nowIso();
  project.metadata = {
    ...project.metadata,
    history: [...(project.metadata?.history || []).slice(-99), { at: nowIso(), action: 'file_delete', detail: p }],
  };
  await saveProject(project);
  return NextResponse.json({ ok: true });
}
