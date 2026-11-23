// Exporta o projeto completo como .zip
import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/storage';
import JSZip from 'jszip';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const project = await getProject(ctx.params.id);
  if (!project) return NextResponse.json({ ok: false, error: 'Projeto não encontrado' }, { status: 404 });
  const zip = new JSZip();
  for (const [p, f] of Object.entries(project.files)) {
    zip.file(p, f.content);
  }
  const readme = `# ${project.name}\n\n${project.description}\n\nExportado do CODNIX IDE em ${new Date().toISOString()}\n`;
  zip.file('README.md', project.files['README.md'] ? project.files['README.md'].content : readme);
  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  const safeName = project.name.replace(/[^\w-]+/g, '-') || 'projeto';
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${safeName}.zip"`,
    },
  });
}
