import type { Persona, PlaylistMetaInput, QueryEnhancerInput, TrackCandidate } from './types'

export function systemPrompt(persona: Persona): string {
  if (persona === 'KIMI') {
    return `You are KIMI, a polished, mainstream music curator for techno and electronic music.
Prioritize high-production value, crowd-pleasing tracks, well-known labels, and safe but exciting selections.
Be concise and return structured JSON only.`
  }

  return `You are CLAUDE, an underground music curator for techno and electronic music.
Prefer raw, leftfield, lesser-known cuts, sub-label deep cuts, and authentic energy over polished production.
Do not fear abrasive or experimental sounds.
Be concise and return structured JSON only.`
}

export function curationUserPrompt(
  persona: Persona,
  promptName: string,
  candidates: TrackCandidate[],
  target: number
): string {
  const candidateText = candidates
    .map(
      (t, i) =>
        `${i + 1}. "${t.title}" by ${t.artist}${t.album ? ` (album: ${t.album})` : ''} [${t.source}]`
    )
    .join('\n')

  return `You are selecting tracks for a Runway discovery run.

Persona: ${persona}
Prompt: ${promptName}

Candidate tracks:
${candidateText}

Select the best ${target} tracks for the ${persona} persona.
Return a JSON object with a single key "tracks" containing an array of objects. Each object must include:
- track_id (string)
- score (number 0-100)
- curation_reason (one sentence explaining why it fits the ${persona} persona)

Only include track_ids that exist in the candidate list.`
}

export function playlistMetaPrompt(input: PlaylistMetaInput): string {
  const parts: string[] = [`Prompt: ${input.promptName}`]
  if (input.genre) parts.push(`Genre: ${input.genre}`)
  if (input.energy) parts.push(`Energy: ${input.energy}`)
  if (input.bpmMin && input.bpmMax) parts.push(`BPM: ${input.bpmMin}-${input.bpmMax}`)

  return `You are naming and describing a playlist for the Runway music discovery dashboard.

Persona: ${input.persona}
${parts.join('\n')}

Return a JSON object with:
- name: a catchy playlist name (prefix with "${input.persona}: ")
- description: a short, engaging description (1-2 sentences)

Keep the total name under 100 characters.`
}

export function queryEnhancerPrompt(input: QueryEnhancerInput): string {
  const sourceTrackText = input.sourceTracks
    .slice(0, 15)
    .map((t) => `- "${t.title}" by ${t.artist}`)
    .join('\n')

  const playlistMeta: string[] = [`Name: ${input.sourcePlaylist.name}`]
  if (input.sourcePlaylist.genre) playlistMeta.push(`Genre: ${input.sourcePlaylist.genre}`)
  if (input.sourcePlaylist.energy) playlistMeta.push(`Energy: ${input.sourcePlaylist.energy}`)
  if (input.sourcePlaylist.bpm_min && input.sourcePlaylist.bpm_max) {
    playlistMeta.push(`BPM: ${input.sourcePlaylist.bpm_min}-${input.sourcePlaylist.bpm_max}`)
  }
  if (input.sourcePlaylist.tags) playlistMeta.push(`Tags: ${input.sourcePlaylist.tags}`)
  if (input.sourcePlaylist.comments) playlistMeta.push(`Notes: ${input.sourcePlaylist.comments}`)

  return `You are generating search queries to find tracks similar to a source playlist.

Persona: ${input.persona}
Target service: ${input.service}

Source playlist:
${playlistMeta.join('\n')}

Sample source tracks:
${sourceTrackText}

Return a JSON object with:
- queries: an array of 3-6 search query strings optimized for ${input.service}
- reasoning: a one-sentence summary of the query strategy

Queries should be short keyword phrases (no boolean operators unless the service supports them). Avoid including the original playlist name verbatim.`
}
