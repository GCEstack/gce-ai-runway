import { callLLM } from './client'
import { curationUserPrompt, systemPrompt } from './prompts'
import type { CurationInput, CuratedTrack } from './types'

export async function curateTracks(input: CurationInput): Promise<CuratedTrack[]> {
  if (input.candidates.length === 0) return []

  try {
    const content = await callLLM({
      persona: input.persona,
      messages: [
        { role: 'system', content: systemPrompt(input.persona) },
        {
          role: 'user',
          content: curationUserPrompt(
            input.persona,
            input.promptName,
            input.candidates,
            input.targetCount
          ),
        },
      ],
      responseFormat: { type: 'json_object' },
    })

    const parsed = JSON.parse(content) as {
      tracks?: Array<{
        track_id?: string
        score?: number
        curation_reason?: string
      }>
    }

    const ranked: CuratedTrack[] = (Array.isArray(parsed.tracks) ? parsed.tracks : [])
      .map((r) => {
        const candidate = input.candidates.find((c) => c.track_id === r.track_id)
        if (!candidate) return null
        return {
          ...candidate,
          score: Number.isFinite(r.score) ? Number(r.score) : 50,
          curation_reason: r.curation_reason ?? '',
        }
      })
      .filter((t): t is CuratedTrack => t !== null)
      .sort((a, b) => b.score - a.score)

    return ranked.slice(0, input.targetCount)
  } catch (err) {
    console.error('[LLM] curation failed, falling back to raw candidates:', err)
    // Fallback: return raw candidates in original order with neutral scores.
    return input.candidates.slice(0, input.targetCount).map((t) => ({
      ...t,
      score: 50,
      curation_reason: '',
    }))
  }
}
