import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient, getAuthenticatedUser } from '@/lib/supabase/server'
import {
  searchSpotify,
  searchTidal,
  createSpotifyPlaylist,
  createTidalPlaylist,
  deduplicateTracks,
  type DiscoveredTrack,
} from '@/lib/music'
import { generatePlaylistMeta } from '@/lib/llm'
import { getBeatportAccessToken } from '@/lib/beatport-auth'
import type { Prompt, Service } from '@/lib/types'
import type { Persona } from '@/lib/llm'

function buildQuery(prompt: Prompt): string {
  const parts: string[] = []
  if (prompt.label) parts.push(`label:"${prompt.label}"`)
  if (prompt.genre) parts.push(prompt.genre)
  if (prompt.energy) parts.push(prompt.energy)
  if (prompt.bpm_min && prompt.bpm_max) parts.push(`${prompt.bpm_min}-${prompt.bpm_max} bpm`)
  return parts.join(' ') || prompt.name
}

// Tidal-friendly genre enhancements — Tidal needs broader electronic context for dance genres
const TIDAL_GENRE_ENHANCE: Record<string, string> = {
  'techno': 'techno electronic dance',
  'house': 'house electronic dance',
  'deep house': 'deep house electronic dance',
  'melodic house': 'melodic house electronic',
  'tech house': 'tech house electronic dance',
  'progressive house': 'progressive house electronic',
  'acid': 'acid electronic techno',
  'trance': 'trance electronic dance',
  'dnb': 'drum and bass electronic',
  'drum & bass': 'drum and bass electronic',
  'breakbeat': 'breakbeat electronic dance',
  'electro': 'electro electronic dance',
  'edm': 'edm electronic dance',
  'minimal': 'minimal techno electronic',
  'raw': 'raw techno electronic',
  'hard techno': 'hard techno electronic',
  'industrial': 'industrial techno electronic',
  'ambient': 'ambient electronic',
  'dub techno': 'dub techno electronic',
}

function buildTidalQueries(prompt: Prompt): string[] {
  const genre = prompt.genre ?? ''
  const label = prompt.label ?? ''
  const energy = prompt.energy ?? ''
  // Tidal does NOT support BPM in text search — skip it entirely

  // Enhance genre for Tidal's catalog
  const enhancedGenre = TIDAL_GENRE_ENHANCE[genre.toLowerCase()] || genre

  const queries: string[] = []

  // Full query: enhanced genre + energy + label (label as plain text, no operator)
  const full = [enhancedGenre, energy, label].filter(Boolean).join(' ')
  if (full) queries.push(full)

  // Without label
  const noLabel = [enhancedGenre, energy].filter(Boolean).join(' ')
  if (noLabel && noLabel !== full) queries.push(noLabel)

  // Just enhanced genre
  if (enhancedGenre && !queries.includes(enhancedGenre)) queries.push(enhancedGenre)

  // Original genre as fallback (if enhanced is different)
  if (genre && genre !== enhancedGenre && !queries.includes(genre)) queries.push(genre)

  // Prompt-name fallback only if it's a real search term (not a Beatport chart slug)
  const promptName = prompt.name?.toLowerCase() ?? ''
  if (prompt.name && !promptName.startsWith('beatport') && !promptName.startsWith('bp_') && !queries.includes(prompt.name)) {
    queries.push(prompt.name)
  }

  return queries.length > 0 ? queries : [prompt.name]
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
  return tracks.filter((t) => {
    if (!t.releaseDate) return false
    return t.releaseDate >= cutoff
  })
}

export async function POST(request: NextRequest) {
  const supabase = await createServiceClient()

  const { user } = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const { prompt_id, agent = 'CLAUDE', service = 'tidal' } = body as {
    prompt_id?: string
    agent?: string
    service?: Service
  }

  if (!prompt_id) {
    return NextResponse.json({ error: 'prompt_id is required' }, { status: 400 })
  }
  if (!agent || !['KIMI', 'CLAUDE'].includes(agent)) {
    return NextResponse.json({ error: 'agent must be KIMI or CLAUDE' }, { status: 400 })
  }
  if (!service || !['spotify', 'tidal', 'beatport'].includes(service)) {
    return NextResponse.json({ error: 'service must be spotify, tidal, or beatport' }, { status: 400 })
  }

  // Get prompt
  const { data: prompt } = await supabase.from('prompts').select('*').eq('id', prompt_id).single()
  if (!prompt) {
    return NextResponse.json({ error: 'Prompt not found' }, { status: 404 })
  }

  const promptName = (prompt as Prompt).name

  // Create run record
  const { data: run, error: runError } = await supabase
    .from('agent_runs')
    .insert({ agent, prompt_name: promptName, status: 'running', user_id: user.id })
    .select()
    .single()

  if (runError || !run) {
    return NextResponse.json({ error: runError?.message ?? 'Failed to create run' }, { status: 500 })
  }

  try {
    // Get token (not needed for Beatport catalog search, but keep structure consistent)
    const { data: tokenRow } = await supabase
      .from('user_tokens')
      .select('access_token, service_user_id')
      .eq('user_id', user.id)
      .eq('service', service)
      .single()

    let token = tokenRow?.access_token ?? ''
    if (!token) {
      throw new Error(`No ${service} token found. Connect your account in Settings.`)
    }

    if (service === 'beatport') {
      const refreshed = await getBeatportAccessToken(user.id, supabase)
      if (refreshed) token = refreshed
    }

    const query = buildQuery(prompt as Prompt)
    const limit = (prompt as Prompt).limit ?? 20

    // Search tracks
    let tracks: DiscoveredTrack[] = []
    let tidalQueries: string[] = [] // track for error message
    if (service === 'spotify') {
      tracks = await searchSpotify(token, query, limit)
    } else if (service === 'tidal') {
      tidalQueries = buildTidalQueries(prompt as Prompt)
      const seen = new Set<string>()
      for (const q of tidalQueries) {
        const results = await searchTidal(token, q, limit)
        console.log(`[RunPrompt] Tidal query "${q}" -> ${results.length} results`)
        for (const t of results) {
          if (!seen.has(t.track_id)) {
            seen.add(t.track_id)
            tracks.push(t)
          }
        }
        if (tracks.length >= limit) break
      }
    } else {
      // beatport: search catalog and save tracks to Supabase (no external playlist creation)
      const { searchBeatport } = await import('@/lib/beatport')
      tracks = await searchBeatport(token, query, limit)
    }

    // Enforce prompt release-date filter
    const dateFiltered = filterByReleaseDate(tracks, (prompt as Prompt).release_date_range)
    const uniqueTracks = deduplicateTracks(dateFiltered).slice(0, limit)

    if (uniqueTracks.length === 0) {
      const msg =
        tracks.length === 0
          ? service === 'tidal' && tidalQueries.length > 0
            ? `No ${service} tracks returned for queries: ${tidalQueries.join(' | ')}. Try a different genre/label/description or check your ${service} connection.`
            : `No ${service} tracks returned for query: "${query}". Try a different genre/label/description or check your ${service} connection.`
          : `${tracks.length} ${service} track${tracks.length === 1 ? '' : 's'} returned for "${query}", but all were excluded by the release-date filter. Try a wider release-date range.`
      throw new Error(msg)
    }

    // LLM: generate persona-aligned playlist name and description.
    let playlistName = `${agent}_${promptName}`
    let description = `Generated by Runway from prompt: ${promptName}`
    try {
      const meta = await generatePlaylistMeta({
        persona: agent as Persona,
        promptName,
        genre: (prompt as Prompt).genre,
        energy: (prompt as Prompt).energy,
        bpmMin: (prompt as Prompt).bpm_min,
        bpmMax: (prompt as Prompt).bpm_max,
      })
      playlistName = meta.name
      description = meta.description
    } catch (e) {
      console.error('[RunPrompt] LLM metadata generation failed, using default:', e)
    }

    // Create playlist (skip for beatport — API doesn't support it)
    let created
    if (service === 'beatport') {
      // Beatport has no playlist creation API — create a virtual playlist record in Supabase
      created = {
        name: playlistName,
        id: `beatport-${Date.now()}`,
        track_count: uniqueTracks.length,
        url: null,
      }
    } else if (service === 'spotify') {
      // Need Spotify user id
      const profileRes = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!profileRes.ok) throw new Error('Failed to fetch Spotify profile')
      const profile = await profileRes.json()
      created = await createSpotifyPlaylist(token, profile.id, playlistName, description, uniqueTracks)
    } else {
      created = await createTidalPlaylist(token, playlistName, description, uniqueTracks)
    }

    // Check for existing playlist from same prompt/agent/service (within last 24h) — refresh instead of duplicate
    let existingPlaylist: { id: string } | null = null
    const { data: existingPlaylists } = await supabase
      .from('playlists')
      .select('id')
      .eq('user_id', user.id)
      .eq('agent', agent)
      .eq('service', service)
      .eq('prompt_name', promptName)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)

    if (existingPlaylists && existingPlaylists.length > 0) {
      existingPlaylist = existingPlaylists[0]
      // Delete old tracks linked to this playlist so we can replace them
      await supabase.from('tracks').delete().eq('playlist_id', existingPlaylist.id)
      console.log('[RunPrompt] Refreshing existing playlist', existingPlaylist.id)
    }

    // Save playlist to Supabase (update if exists, insert if new)
    let playlistRecord
    if (existingPlaylist) {
      const { data, error } = await supabase
        .from('playlists')
        .update({
          name: created.name,
          external_id: created.id,
          track_count: created.track_count,
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingPlaylist.id)
        .select()
        .single()
      playlistRecord = data
      if (error) console.error('[RunPrompt] Failed to update playlist:', error)
    } else {
      const { data, error } = await supabase
        .from('playlists')
        .insert({
          name: created.name,
          agent,
          service,
          external_id: created.id,
          track_count: created.track_count,
          prompt_name: promptName,
          user_id: user.id,
        })
        .select()
        .single()
      playlistRecord = data
      if (error) console.error('[RunPrompt] Failed to save playlist record:', error)
    }

    // Save tracks and link them to the playlist so they appear in the dashboard
    if (playlistRecord) {
      const trackRows = uniqueTracks.map((track) => ({
        title: track.title,
        artist: track.artist,
        album: track.album,
        source: track.source,
        discovered_by: agent,
        discovered_at: new Date().toISOString(),
        prompt_name: promptName,
        playlist_id: playlistRecord.id,
        release_date: track.releaseDate ?? null,
        user_id: user.id,
      }))
      const { error: tracksError } = await supabase.from('tracks').insert(trackRows)
      if (tracksError) {
        console.error('[RunPrompt] Failed to save tracks:', tracksError)
      }
    }

    // Complete run
    await supabase
      .from('agent_runs')
      .update({
        status: 'completed',
        tracks_found: uniqueTracks.length,
        tracks_matched: uniqueTracks.length,
        completed_at: new Date().toISOString(),
      })
      .eq('id', run.id)

    return NextResponse.json({
      run_id: run.id,
      status: 'completed',
      playlist: created,
      refreshed: !!existingPlaylist,
      saved: !!playlistRecord,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await supabase
      .from('agent_runs')
      .update({ status: 'failed', completed_at: new Date().toISOString() })
      .eq('id', run.id)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
