// Indexacao do projeto: outline estrutural para a IA compreender o projeto
// sem enviar todos os arquivos (controle de contexto).
import { NextRequest, NextResponse } from 'next/server';
import { getProject, saveProject } from '@/lib/storage';
import { languageFor } from '@/lib/languages';
import { nowIso } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

const IGNORE = ['node_modules', '.git', 'dist', 'build', 'out', 'bin', '__pycache__', '.next'];

function buildOutline(files: Record<string, { content: string }>): string {
  const paths = Object.keys(files).sort();
  const lines: string[] = [`Total: ${paths.length} arquivos`];
  for (const p of paths) {
    if (IGNORE.some((d) => p.split('/').includes(d))) continue;
    const lang = languageFor(p);
    const content = files[p] || { content: '' };
    const src = content.content.split('\n');
    const summary: string[] = [];
    // captura declaracoes principais (funcoes/classes) por linguagem
    const declRe = /(?:function|class|interface|def|fn|func|public|private|struct|impl|const)\s+\w+/;
    for (let i = 0; i < Math.min(src.length, 400); i++) {
      const line = src[i].trim();
      if (declRe.test(line) && !summary.some((s) => s === `  ${line.slice(0, 90)}`)) {
        summary.push(`  ${line.slice(0, 90)}`);
        if (summary.length >= 6) break;
      }
    }
    lines.push(`${p} (${lang.label}, ${src.length} linhas)${summary.length ? ':\n' + summary.join('\n') : ''}`);
  }
  return lines.join('\n').slice(0, 12000);
}

export async function POST(_req: NextRequest, ctx: Ctx) {
  const project = await getProject(ctx.params.id);
  if (!project) return NextResponse.json({ ok: false, error: 'Projeto não encontrado' }, { status: 404 });
  const outline = buildOutline(project.files);
  const index = {
    builtAt: nowIso(),
    outline,
    fileCount: Object.keys(project.files).length,
    totalChars: Object.values(project.files).reduce((a, f) => a + f.content.length, 0),
  };
  project.metadata = { ...project.metadata, index };
  project.updated_at = nowIso();
  await saveProject(project);
  return NextResponse.json({ ok: true, index });
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const project = await getProject(ctx.params.id);
  if (!project) return NextResponse.json({ ok: false, error: 'Projeto não encontrado' }, { status: 404 });
  return NextResponse.json({ ok: true, index: project.metadata?.index || null });
}
