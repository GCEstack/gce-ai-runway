import { callLLM } from './client'
import { queryEnhancerPrompt, systemPrompt } from './prompts'
import type { EnhancedQueries, QueryEnhancerInput } from './types'

export async function enhanceQueries(input: QueryEnhancerInput): Promise<EnhancedQueries> {
  try {
    const content = await callLLM({
      persona: input.persona,
      messages: [
        { role: 'system', content: systemPrompt(input.persona) },
        { role: 'user', content: queryEnhancerPrompt(input) },
      ],
      responseFormat: { type: 'json_object' },
    })

    const parsed = JSON.parse(content) as Partial<EnhancedQueries>
    const queries = Array.isArray(parsed.queries)
      ? parsed.queries.filter((q): q is string => typeof q === 'string' && q.length > 0)
      : []

    if (queries.length === 0) {
      throw new Error('LLM returned no queries')
    }

    return {
      queries,
      reasoning: parsed.reasoning ?? '',
    }
  } catch (err) {
    console.error('[LLM] query enhancement failed:', err)
    throw err
  }
}
