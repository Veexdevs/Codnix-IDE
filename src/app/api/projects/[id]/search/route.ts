// Busca textual dentro dos arquivos do projeto (contexto/indexacao).
import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/storage';
import { sanitizeRelPath } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

export async function GET(req: NextRequest, ctx: Ctx) {
  const project = await getProject(ctx.params.id);
  if (!project) return NextResponse.json({ ok: false, error: 'Projeto não encontrado' }, { status: 404 });
  const q = (req.nextUrl.searchParams.get('q') || '').trim().toLowerCase();
  if (!q) return NextResponse.json({ ok: true, results: [] });

  const results: { path: string; line: number; text: string; fileNameMatch?: boolean }[] = [];
  const EXCLUDED = ['node_modules', 'bin', 'dist', 'build', 'out', '__pycache__', '.next'];
  for (const [p, f] of Object.entries(project.files)) {
    if (EXCLUDED.some((d) => p.split('/').includes(d))) continue;
    if (f.content.includes('\u0000')) continue; // binário
    if (p.toLowerCase().includes(q)) {
      results.push({ path: p, line: 0, text: f.content.split('\n')[0]?.slice(0, 120) || '', fileNameMatch: true });
    }
    const lines = f.content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (results.length >= 120) break;
      if (lines[i].toLowerCase().includes(q)) {
        results.push({ path: p, line: i + 1, text: lines[i].trim().slice(0, 160) });
      }
    }
    if (results.length >= 120) break;
  }
  return NextResponse.json({ ok: true, results, query: q });
}
