/**
 * Rewrite proxy: asks an LLM to produce a safer, generic version of a user's
 * prompt that preserves intent but strips specific identifiers. Reuses the
 * same provider toggle (Claude / Ollama) as /api/chat.
 *
 *   POST /api/rewrite
 *   body: { provider: 'claude' | 'ollama', prompt: string, categories?: string[], model?: string }
 *   resp: { provider, model, rewritten, changes_summary }  |  { error }
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

type RewriteBody = {
  provider?: 'claude' | 'ollama';
  prompt?: string;
  categories?: string[];
  model?: string;
};

const SYSTEM_PROMPT = `You are PromptShield's safer-rewrite assistant. Rewrite the user's prompt so it preserves the original question and intent, but removes specific identifiers and sensitive details.

Rules:
- Replace real names, emails, IDs, account numbers, dates of birth, addresses, secrets, and other identifiers with generic placeholders (e.g. "a patient", "an employee", "an API key").
- Keep the request's purpose and structure intact so the AI can still answer it meaningfully.
- Do NOT invent new facts, do NOT add disclaimers, do NOT explain what you changed inside the rewrite itself.
- If the prompt has no rewritable sensitive content, return the original prompt unchanged.

Respond with STRICT JSON only, no markdown fences, no prose before or after:
{"rewritten": "<the rewritten prompt>", "changes_summary": ["<short bullet 1>", "<short bullet 2>"]}`;

function buildUserMessage(prompt: string, categories?: string[]) {
  const catLine =
    categories && categories.length > 0
      ? `Sensitive categories detected: ${categories.join(', ')}.\n\n`
      : '';
  return `${catLine}Original prompt:\n"""\n${prompt}\n"""\n\nReturn the JSON described in the system instructions.`;
}

function parseModelJson(raw: string): { rewritten: string; changes_summary: string[] } {
  // Strip code fences if the model added them despite instructions.
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }

  const parsed = JSON.parse(text);
  const rewritten = typeof parsed.rewritten === 'string' ? parsed.rewritten : '';
  const changes_summary = Array.isArray(parsed.changes_summary)
    ? parsed.changes_summary.filter((s: unknown) => typeof s === 'string')
    : [];
  return { rewritten, changes_summary };
}

export async function POST(req: NextRequest) {
  let body: RewriteBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { provider, prompt, categories, model } = body;

  if (!prompt || typeof prompt !== 'string') {
    return NextResponse.json({ error: 'Missing "prompt" string' }, { status: 400 });
  }

  try {
    if (provider === 'claude') return await callClaude(prompt, categories, model);
    if (provider === 'ollama') return await callOllama(prompt, categories, model);
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

async function callClaude(prompt: string, categories?: string[], modelOverride?: string) {
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
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserMessage(prompt, categories) }],
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
  const raw = Array.isArray(data?.content)
    ? data.content
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('\n')
    : '';

  let parsed;
  try {
    parsed = parseModelJson(raw);
  } catch {
    return NextResponse.json(
      { error: 'Model did not return valid JSON', raw },
      { status: 502 }
    );
  }

  return NextResponse.json({ provider: 'claude', model, ...parsed });
}

async function callOllama(prompt: string, categories?: string[], modelOverride?: string) {
  const model = modelOverride ?? OLLAMA_DEFAULT_MODEL;

  let res: Response;
  try {
    res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserMessage(prompt, categories) },
        ],
        stream: false,
        format: 'json',
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
  const raw: string = data?.message?.content ?? '';

  let parsed;
  try {
    parsed = parseModelJson(raw);
  } catch {
    return NextResponse.json(
      { error: 'Model did not return valid JSON', raw },
      { status: 502 }
    );
  }

  return NextResponse.json({ provider: 'ollama', model, ...parsed });
}
