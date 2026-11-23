// Historico de conversas sincronizado (server-side).
import { NextRequest, NextResponse } from 'next/server';
import { listConversations, saveConversation, deleteConversation } from '@/lib/storage';
import type { Conversation } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const conversations = await listConversations();
    return NextResponse.json({ ok: true, conversations });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let conv: Conversation;
  try {
    conv = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Corpo inválido' }, { status: 400 });
  }
  if (!conv?.id) return NextResponse.json({ ok: false, error: 'Informe id' }, { status: 400 });
  if (!Array.isArray(conv.messages)) conv.messages = [];
  await saveConversation(conv);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false, error: 'Informe id' }, { status: 400 });
  await deleteConversation(id);
  return NextResponse.json({ ok: true });
}
