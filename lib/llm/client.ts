import type { LLMOptions, Persona } from './types'

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

const DEFAULT_MODELS: Record<Persona, string> = {
  KIMI: 'openai/gpt-4o',
  CLAUDE: 'anthropic/claude-3.5-sonnet',
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const copy = { ...headers }
  if (copy.Authorization) copy.Authorization = 'Bearer [REDACTED]'
  return copy
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...init, signal: abort.signal })
    return res
  } finally {
    clearTimeout(timer)
  }
}

export async function callLLM(opts: LLMOptions): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set')
  }

  const model = process.env.LLM_MODEL ?? DEFAULT_MODELS[opts.persona]
  const timeoutMs = parseInt(process.env.LLM_TIMEOUT_MS ?? '30000', 10)
  const maxRetries = parseInt(process.env.LLM_MAX_RETRIES ?? '3', 10)

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL ?? '',
    'X-Title': 'Runway Music Discovery',
  }

  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.4,
    max_tokens: opts.max_tokens ?? 2048,
  }

  if (opts.responseFormat?.type === 'json_object') {
    body.response_format = { type: 'json_object' }
  } else if (opts.responseFormat?.type === 'json_schema' && opts.responseFormat.schema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: { name: 'response', schema: opts.responseFormat.schema },
    }
  }

  let lastError: Error | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetchWithTimeout(
        `${OPENROUTER_BASE}/chat/completions`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        },
        timeoutMs
      )

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 200)}`)
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      const content = data.choices?.[0]?.message?.content ?? ''
      if (!content) {
        throw new Error('OpenRouter returned empty content')
      }
      return content
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.error(`[LLM] call failed (attempt ${attempt + 1}/${maxRetries + 1}):`, lastError.message)

      if (attempt < maxRetries) {
        const delay = Math.min(1000 * 2 ** attempt, 8000)
        await sleep(delay)
      }
    }
  }

  console.error('[LLM] final request headers (redacted):', redactHeaders(headers))
  throw lastError ?? new Error('LLM call failed after retries')
}
