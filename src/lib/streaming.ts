// Leitura do stream SSE do OpenRouter (proxy /api/chat).
import { apiUrl } from './api-client';

export interface StreamResult {
  content: string;
  model: string;
  error?: string;
  errorCode?: string;
}

export interface StreamOptions {
  model: string;
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
  onDelta?: (chunk: string, full: string) => void;
  onModel?: (model: string) => void;
}

export async function streamChat(opts: StreamOptions): Promise<StreamResult> {
  let content = '';
  let model = opts.model;

  try {
    const res = await fetch(apiUrl('/api/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        stream: true,
      }),
      signal: opts.signal,
    });

    if (!res.ok || !res.body) {
      const json = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      return { content, model, error: json?.error || `HTTP ${res.status}`, errorCode: json?.code };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const raw of lines) {
        const line = raw.trim();
        if (!line || line.startsWith(':')) continue;
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          if (json.model) model = json.model;
          const delta: string = json.choices?.[0]?.delta?.content ?? '';
          const errMsg: string | undefined = json.error?.message || json.error?.code;
          if (errMsg) {
            return { content, model, error: errMsg, errorCode: json.error?.code };
          }
          if (delta) {
            content += delta;
            opts.onDelta?.(delta, content);
          }
        } catch {
          // linha parcial ou comentario — ignora
        }
      }
    }
    return { content, model };
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      return { content, model, error: '__aborted__' };
    }
    return { content, model, error: `Falha de conexão com o servidor: ${(e as Error).message}`, errorCode: 'CONNECTION_ERROR' };
  }
}
