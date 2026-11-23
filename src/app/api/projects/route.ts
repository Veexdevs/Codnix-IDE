// CRUD de projetos.
import { NextRequest, NextResponse } from 'next/server';
import { listProjects, saveProject, getProject } from '@/lib/storage';
import { TEMPLATES, templateById } from '@/lib/templates';
import { uid, nowIso } from '@/lib/utils';
import type { Project } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const projects = await listProjects();
    return NextResponse.json({ ok: true, projects });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { name?: string; description?: string; template?: string; seedDemo?: boolean };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const templateId = body.seedDemo ? 'cpp' : (body.template || 'web-app');
  const tpl = templateById(templateId) || TEMPLATES[0];
  const name = (body.name || (body.seedDemo ? 'MeuProjeto' : 'Novo Projeto')).trim().slice(0, 80);
  const description = (body.description || tpl.description).trim().slice(0, 300);

  const project: Project = {
    id: uid('p_'),
    name,
    description,
    template: tpl.id,
    favorite: false,
    files: Object.fromEntries(
      Object.entries(tpl.files).map(([p, content]) => [p, { content, updated_at: nowIso() }])
    ),
    metadata: { modelsUsed: [], history: [{ at: nowIso(), action: 'create', detail: `template: ${tpl.id}` }] },
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await saveProject(project);
  return NextResponse.json({ ok: true, project });
}

export async function PATCH(req: NextRequest) {
  // seed: cria projeto demo se nao existir nenhum
  const existing = await listProjects();
  if (existing.length === 0) {
    const tpl = templateById('cpp')!;
    const project: Project = {
      id: uid('p_'),
      name: 'MeuProjeto',
      description: tpl.description,
      template: 'cpp',
      favorite: false,
      files: Object.fromEntries(Object.entries(tpl.files).map(([p, content]) => [p, { content, updated_at: nowIso() }])),
      metadata: { modelsUsed: [], history: [{ at: nowIso(), action: 'create', detail: 'demo inicial' }] },
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    await saveProject(project);
    return NextResponse.json({ ok: true, seeded: true, projects: await listProjects() });
  }
  return NextResponse.json({ ok: true, seeded: false, projects: existing });
}
