import { NextResponse } from 'next/server';
import { storageMode } from '@/lib/storage';
import { resolveApiKey } from '@/lib/openrouter';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { source } = await resolveApiKey();
  return NextResponse.json({
    ok: true,
    name: 'CODNIX IDE',
    version: '1.0.0',
    storage: storageMode(),
    apiKeyConfigured: source !== null,
    apiKeySource: source,
    time: new Date().toISOString(),
  });
}
