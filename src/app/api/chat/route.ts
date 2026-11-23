// Proxy de chat para o OpenRouter com streaming SSE.
// A chave fica no servidor; o cliente recebe apenas o stream de tokens.
import { NextRequest } from 'next/server';
import { OR_BASE, mapOpenRouterError, orHeaders, resolveApiKey } from '@/lib/openrouter';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface ChatBody {
  model?: string;
  messages?: { role: string; content: unknown }[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
}

export async function POST(req: NextRequest) {
  let body: ChatBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'Corpo inválido' }, { status: 400 });
  }

  const { key, source } = await resolveApiKey();
  if (!key) {
    return Response.json(
      {
        ok: false,
        code: 'NO_API_KEY',
        error: 'Nenhuma chave da API do OpenRouter configurada. Abra Configurações → OpenRouter e adicione sua chave.',
      },
      { status: 401 }
    );
  }

  if (!body.model || !Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json({ ok: false, error: 'Informe o modelo e as mensagens.' }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${OR_BASE}/chat/completions`, {
      method: 'POST',
      headers: orHeaders(key),
      body: JSON.stringify({
        model: body.model,
        messages: body.messages,
        temperature: body.temperature ?? 0.7,
        max_tokens: body.max_tokens ?? undefined,
        top_p: body.top_p ?? undefined,
        stream: body.stream !== false,
      }),
      signal: req.signal,
    });
  } catch (e) {
    if (req.signal.aborted) return new Response(null, { status: 499 });
    return Response.json(
      { ok: false, code: 'CONNECTION_ERROR', error: `Falha de conexão com o OpenRouter: ${e instanceof Error ? e.message : e}` },
      { status: 502 }
    );
  }

  if (!upstream.ok) {
    const text = await upstream.text();
    const mapped = mapOpenRouterError(upstream.status, text);
    return Response.json(
      { ok: false, code: mapped.code, error: mapped.message },
      { status: mapped.status === 401 && source === 'settings' ? 401 : mapped.status }
    );
  }

  // Streaming SSE direto do OpenRouter
  const headers = {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  };
  return new Response(upstream.body, { status: 200, headers });
}
