import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { searchSpotify, searchTidal, deduplicateTracks, type DiscoveredTrack } from '@/lib/music'
import { curateTracks } from '@/lib/llm'
import type { Prompt } from '@/lib/types'
import type { Persona } from '@/lib/llm'

function buildQuery(prompt: Prompt, feedTitle?: string | null): string {
  const parts: string[] = []
  if (prompt.label) parts.push(`label:"${prompt.label}"`)
  if (prompt.genre) parts.push(prompt.genre)
  if (prompt.energy) parts.push(prompt.energy)
  if (prompt.bpm_min && prompt.bpm_max) parts.push(`${prompt.bpm_min}-${prompt.bpm_max} bpm`)
  return parts.length > 0 ? parts.join(' ') : (feedTitle ?? '')
}

function releaseDateCutoff(range: string | null): string | null {
  const now = new Date()
  switch (range) {
    case 'last_3_months':
      now.setMonth(now.getMonth() - 3)
      break
    case 'last_6_months':
      now.setMonth(now.getMonth() - 6)
      break
    case 'last_year':
      now.setFullYear(now.getFullYear() - 1)
      break
    case 'all':
      return null
    default:
      now.setMonth(now.getMonth() - 3)
  }
  return now.toISOString().slice(0, 10)
}

function filterByReleaseDate(tracks: DiscoveredTrack[], range: string | null): DiscoveredTrack[] {
  const cutoff = releaseDateCutoff(range)
  if (!cutoff) return tracks
  return tracks.filter((t) => t.releaseDate && t.releaseDate >= cutoff)
}

export async function POST(request: NextRequest) {
  const supabase = await createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const { prompt_id, agent = 'CLAUDE', feed_item_id } = body as {
    prompt_id?: string
    agent?: string
    feed_item_id?: string
  }

  if (!agent || !['KIMI', 'CLAUDE'].includes(agent)) {
    return NextResponse.json({ error: 'agent must be KIMI or CLAUDE' }, { status: 400 })
  }

  let prompt: Prompt | null = null
  let promptName: string | null = null
  let feedTitle: string | null = null

  if (prompt_id) {
    const { data: p } = await supabase.from('prompts').select('*').eq('id', prompt_id).single()
    prompt = p as Prompt | null
    promptName = prompt?.name ?? null
  } else if (feed_item_id) {
    const { data: fi } = await supabase.from('feed_items').select('title').eq('id', feed_item_id).single()
    feedTitle = fi?.title ?? null
    promptName = feedTitle ? `feed:${feedTitle.slice(0, 40)}` : null
  }

  if (!promptName) {
    return NextResponse.json({ error: 'prompt_id or feed_item_id required' }, { status: 400 })
  }

  const { data: run, error } = await supabase
    .from('agent_runs')
    .insert({ agent, prompt_name: promptName, status: 'running', user_id: user.id })
    .select()
    .single()

  if (error || !run) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create run' }, { status: 500 })
  }

  const { data: tokens } = await supabase
    .from('user_tokens')
    .select('service, access_token')
    .eq('user_id', user.id)

  const spotifyToken = tokens?.find((t) => t.service === 'spotify')?.access_token
  const tidalToken = tokens?.find((t) => t.service === 'tidal')?.access_token

  if (!spotifyToken && !tidalToken) {
    await supabase.from('agent_runs').update({ status: 'failed', completed_at: new Date().toISOString() }).eq('id', run.id)
    return NextResponse.json({ error: 'No Spotify or Tidal tokens found. Connect an account in Settings.' }, { status: 400 })
  }

  const query = prompt ? buildQuery(prompt, feedTitle) : (feedTitle ?? '')
  const limit = prompt?.limit ?? 20

  const [spotifyResults, tidalResults] = await Promise.all([
    spotifyToken ? searchSpotify(spotifyToken, query, limit) : Promise.resolve([]),
    tidalToken ? searchTidal(tidalToken, query, limit) : Promise.resolve([]),
  ])

  const allResults: DiscoveredTrack[] = [...spotifyResults, ...tidalResults]
  const dateFiltered = prompt
    ? filterByReleaseDate(allResults, prompt.release_date_range)
    : allResults
  const rawResults = deduplicateTracks(dateFiltered).slice(0, limit)

  // LLM: curate raw results according to the selected persona.
  let finalResults = rawResults
  try {
    finalResults = await curateTracks({
      persona: agent as Persona,
      promptName: promptName!,
      candidates: rawResults.map((t) => ({
        title: t.title,
        artist: t.artist,
        album: t.album,
        source: t.source,
        track_id: t.track_id,
        url: t.url,
        releaseDate: t.releaseDate,
      })),
      targetCount: limit,
    })
  } catch (e) {
    console.error('[Discover] LLM curation failed, using raw results:', e)
  }

  for (const track of finalResults) {
    await supabase.from('tracks').insert({
      title: track.title,
      artist: track.artist,
      album: track.album,
      source: track.source,
      discovered_by: agent,
      discovered_at: new Date().toISOString(),
      prompt_name: promptName,
      release_date: track.releaseDate ?? null,
      user_id: user.id,
    })
  }

  await supabase
    .from('agent_runs')
    .update({
      status: 'completed',
      tracks_found: finalResults.length,
      tracks_matched: finalResults.length,
      completed_at: new Date().toISOString(),
    })
    .eq('id', run.id)

  return NextResponse.json({
    run_id: run.id,
    agent,
    prompt_name: promptName,
    status: 'completed',
    tracks_found: finalResults.length,
  })
}
