/**
 * Chat proxy: forwards a (masked) prompt to either Claude or a local Ollama
 * instance and returns the assistant's reply. Keeps API keys server-side.
 *
 *   POST /api/chat
 *   body: { provider: 'claude' | 'ollama', prompt: string, model?: string }
 *   resp: { provider, model, content }  |  { error }
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CLAUDE_DEFAULT_MODEL =
  process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-5-20250929';

const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';

const OLLAMA_DEFAULT_MODEL =
  process.env.OLLAMA_MODEL ?? 'qwen3:latest';

type ChatBody = {
  provider?: 'claude' | 'ollama';
  prompt?: string;
  model?: string;
};

export async function POST(req: NextRequest) {
  let body: ChatBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { provider, prompt, model } = body;

  if (!prompt || typeof prompt !== 'string') {
    return NextResponse.json({ error: 'Missing "prompt" string' }, { status: 400 });
  }

  try {
    if (provider === 'claude') return await callClaude(prompt, model);
    if (provider === 'ollama') return await callOllama(prompt, model);
    return NextResponse.json(
      { error: `Unknown provider "${provider}". Expected "claude" or "ollama".` },
      { status: 400 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Request failed' },
      { status: 500 }
    );
  }
}

async function callClaude(prompt: string, modelOverride?: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not set in dashboard/.env.local' },
      { status: 500 }
    );
  }

  const model = modelOverride ?? CLAUDE_DEFAULT_MODEL;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: `Claude API ${res.status}: ${text}` },
      { status: 502 }
    );
  }

  const data = await res.json();
  const content =
    Array.isArray(data?.content)
      ? data.content
          .filter((b: any) => b.type === 'text')
          .map((b: any) => b.text)
          .join('\n')
      : '';

  return NextResponse.json({ provider: 'claude', model, content });
}

async function callOllama(prompt: string, modelOverride?: string) {
  const model = modelOverride ?? OLLAMA_DEFAULT_MODEL;

  let res: Response;
  try {
    res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
      }),
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        error:
          `Could not reach Ollama at ${OLLAMA_BASE_URL}. ` +
          `Is the daemon running? (try: ollama serve)  Underlying error: ${e?.message ?? e}`,
      },
      { status: 502 }
    );
  }

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: `Ollama ${res.status}: ${text}` },
      { status: 502 }
    );
  }

  const data = await res.json();
  const content = data?.message?.content ?? '';

  return NextResponse.json({ provider: 'ollama', model, content });
}
