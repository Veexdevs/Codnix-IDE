import { NextRequest, NextResponse } from 'next/server';
import { getProject, saveProject, deleteProject } from '@/lib/storage';
import { nowIso, sanitizeRelPath } from '@/lib/utils';
import type { Project } from '@/types';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const project = await getProject(ctx.params.id);
  if (!project) return NextResponse.json({ ok: false, error: 'Projeto não encontrado' }, { status: 404 });
  return NextResponse.json({ ok: true, project });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const project = await getProject(ctx.params.id);
  if (!project) return NextResponse.json({ ok: false, error: 'Projeto não encontrado' }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.name === 'string') project.name = body.name.slice(0, 80) || project.name;
  if (typeof body.description === 'string') project.description = body.description.slice(0, 300);
  if (typeof body.favorite === 'boolean') project.favorite = body.favorite;
  if (body.modelUsed) {
    const models = new Set(project.metadata?.modelsUsed || []);
    models.add(String(body.modelUsed).slice(0, 120));
    project.metadata = { ...project.metadata, modelsUsed: Array.from(models).slice(-12) };
  }
  if (body.index) {
    project.metadata = { ...project.metadata, index: body.index };
  }
  if (body.historyEvent) {
    project.metadata = {
      ...project.metadata,
      history: [...(project.metadata?.history || []).slice(-99), body.historyEvent],
    };
  }
  project.updated_at = nowIso();
  await saveProject(project);
  return NextResponse.json({ ok: true, project });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  await deleteProject(ctx.params.id);
  return NextResponse.json({ ok: true });
}
