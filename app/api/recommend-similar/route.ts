import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  searchSpotify,
  searchTidal,
  getTidalPlaylistTracks,
  getSpotifyPlaylistTracks,
  createSpotifyPlaylist,
  createTidalPlaylist,
  deduplicateTracks,
  type DiscoveredTrack,
} from '@/lib/music'
import type { Playlist, Service } from '@/lib/types'

const DANCE_DESCRIPTORS = new Set([
  'dance', 'electronic', 'techno', 'house', 'acid', 'raw', 'hard', 'trance', 'dnb', 'drum', 'bass',
  'breakbeat', 'electro', 'edm', 'rave', 'club', 'festival', 'underground',
])

const ROCK_DESCRIPTORS = new Set([
  'rock', 'metal', 'punk', 'indie rock', 'hard rock', 'alternative rock', 'country', 'folk', 'blues',
  'jazz', 'classical', 'singer-songwriter',
])

function isRecent(track: DiscoveredTrack, months: number): boolean {
  if (!track.releaseDate) return false
  const d = new Date(track.releaseDate)
  if (isNaN(d.getTime())) return false
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - months)
  return d >= cutoff
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractGenreTags(name: string): string[] {
  const matches = name.match(/\[([^\]]+)\]/g) ?? []
  return matches
    .map((tag) => tag.replace(/[\[\]]/g, '').replace(/\//g, ' '))
    .flatMap((tag) => tag.split(/\s+/))
    .filter(Boolean)
}

function isDanceContext(source: Playlist, sourceTracks: DiscoveredTrack[]): boolean {
  const text = normalize(
    [source.name, source.tags ?? '', source.comments ?? '', source.energy ?? ''].join(' ')
  )
  const tokens = new Set(text.split(/\s+/))
  if (Array.from(DANCE_DESCRIPTORS).some((d) => tokens.has(d))) return true
  const trackText = normalize(sourceTracks.map((t) => `${t.title} ${t.artist} ${t.album ?? ''}`).join(' '))
  const trackTokens = new Set(trackText.split(/\s+/))
  return Array.from(DANCE_DESCRIPTORS).some((d) => trackTokens.has(d))
}

function scoreTrackRelevance(track: DiscoveredTrack, source: Playlist, sourceTracks: DiscoveredTrack[]): number {
  const sourceArtistSet = new Set(sourceTracks.map((t) => normalize(t.artist)))
  const trackArtistNorm = normalize(track.artist)
  const trackTitleNorm = normalize(track.title)

  let score = 0

  // Same artist is strong signal but not identical
  if (sourceArtistSet.has(trackArtistNorm)) {
    score += 3
  }

  // Overlap with source genre tags
  const genreTags = extractGenreTags(source.name)
  for (const tag of genreTags) {
    if (trackTitleNorm.includes(tag) || trackArtistNorm.includes(tag)) {
      score += 2
    }
  }

  // Source metadata tags overlap
  const sourceTags = normalize(source.tags ?? '').split(/\s+/)
  for (const tag of sourceTags) {
    if (tag.length < 3) continue
    if (trackTitleNorm.includes(tag) || trackArtistNorm.includes(tag)) {
      score += 1.5
    }
  }

  // Prefer dance context if source is dance
  if (isDanceContext(source, sourceTracks)) {
    const trackTokens = new Set([...trackTitleNorm.split(/\s+/), ...trackArtistNorm.split(/\s+/)])
    if (Array.from(DANCE_DESCRIPTORS).some((d) => trackTokens.has(d))) score += 1
    if (Array.from(ROCK_DESCRIPTORS).some((d) => trackTokens.has(d))) score -= 3
  }

  // Slight boost for recent tracks
  if (isRecent(track, 6)) score += 0.5

  return score
}

function buildQueries(source: Playlist, sourceTracks: DiscoveredTrack[]): string[] {
  const genreTags = extractGenreTags(source.name)
  const metadataTags = (source.tags ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
  const comments = (source.comments ?? '').split(/\s+/).filter((w) => w.length > 2).slice(0, 6)

  const tagClause = [...genreTags, ...metadataTags].slice(0, 4).join(' ')

  // Top artists from the source playlist
  const artistCounts = new Map<string, number>()
  for (const t of sourceTracks) {
    artistCounts.set(t.artist, (artistCounts.get(t.artist) ?? 0) + 1)
  }
  const topArtists = Array.from(artistCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)
    .slice(0, 5)

  const queries: string[] = []

  // Broad genre + metadata query
  const broadParts = [tagClause, ...comments].filter(Boolean)
  if (broadParts.length) {
    queries.push(broadParts.join(' '))
  }

  // Artist-specific queries with genre context
  for (const artist of topArtists) {
    const q = [artist, tagClause].filter(Boolean).join(' ')
    if (q) queries.push(q)
  }

  // Fallback to name keywords if we have nothing
  if (queries.length === 0) {
    const nameKeywords = normalize(source.name)
      .split(/\s+/)
      .filter((w) => w.length > 2 && !['sample', 'balancing', 'minutos', 'similar', 'to', 'dekan'].includes(w))
      .slice(0, 4)
      .join(' ')
    queries.push(nameKeywords || source.name)
  }

  return queries
}

export async function POST(request: NextRequest) {
  const supabase = await createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const { playlist_id, agent = 'CLAUDE', service = 'tidal' } = body as {
    playlist_id?: string
    agent?: string
    service?: Service
  }

  if (!playlist_id) {
    return NextResponse.json({ error: 'playlist_id is required' }, { status: 400 })
  }
  if (!agent || !['KIMI', 'CLAUDE'].includes(agent)) {
    return NextResponse.json({ error: 'agent must be KIMI or CLAUDE' }, { status: 400 })
  }
  if (!service || !['spotify', 'tidal'].includes(service)) {
    return NextResponse.json({ error: 'service must be spotify or tidal' }, { status: 400 })
  }

  const { data: source } = await supabase.from('playlists').select('*').eq('id', playlist_id).single()
  if (!source) {
    return NextResponse.json({ error: 'Playlist not found' }, { status: 404 })
  }
  if (source.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sourcePlaylist = source as Playlist
  const sourceName = sourcePlaylist.name
  const promptName = `similar:${sourceName.slice(0, 60)}`

  const { data: run, error: runError } = await supabase
    .from('agent_runs')
    .insert({ agent, prompt_name: promptName, status: 'running' })
    .select()
    .single()

  if (runError || !run) {
    return NextResponse.json({ error: runError?.message ?? 'Failed to create run' }, { status: 500 })
  }

  try {
    const { data: tokenRow } = await supabase
      .from('user_tokens')
      .select('access_token, service_user_id')
      .eq('user_id', user.id)
      .eq('service', service)
      .single()

    if (!tokenRow?.access_token) {
      throw new Error(`No ${service} token found. Connect your account in Settings.`)
    }

    const token = tokenRow.access_token
    const targetTrackCount = 20

    // Ingest source playlist tracks so recommendations actually sound like the source
    let sourceTracks: DiscoveredTrack[] = []
    if (service === 'tidal' && sourcePlaylist.external_id) {
      sourceTracks = await getTidalPlaylistTracks(token, sourcePlaylist.external_id)
    } else if (service === 'spotify' && sourcePlaylist.external_id) {
      sourceTracks = await getSpotifyPlaylistTracks(token, sourcePlaylist.external_id)
    }

    const queries = buildQueries(sourcePlaylist, sourceTracks)
    console.log('[recommend-similar] queries:', queries)

    // Run searches and collect candidates
    const candidateMap = new Map<string, DiscoveredTrack>()
    for (const query of queries) {
      const results = service === 'spotify'
        ? await searchSpotify(token, query, 30)
        : await searchTidal(token, query, 30)

      for (const track of results) {
        if (!candidateMap.has(track.track_id)) {
          candidateMap.set(track.track_id, track)
        }
      }
    }

    // Score and rank by relevance to source
    const scored = Array.from(candidateMap.values())
      .map((track) => ({
        track,
        score: scoreTrackRelevance(track, sourcePlaylist, sourceTracks),
      }))
      .sort((a, b) => b.score - a.score)

    // Prefer recent tracks, but fall back to best matches if needed
    const recent = scored.filter(({ track }) => isRecent(track, 3))
    let selected = recent.length >= targetTrackCount
      ? recent.slice(0, targetTrackCount)
      : [...recent, ...scored.filter((s) => !recent.includes(s))].slice(0, targetTrackCount)

    if (selected.length === 0) {
      throw new Error(`No ${service} tracks found for query set: ${queries.join(' | ')}`)
    }

    const finalTracks = selected.map((s) => s.track)

    const playlistName = `${agent}_Similar_to_${sourceName}`.slice(0, 100)
    const description = `Runway recommendations based on: ${sourceName}. ${finalTracks.length} tracks.`

    let created
    if (service === 'spotify') {
      const profileRes = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!profileRes.ok) throw new Error('Failed to fetch Spotify profile')
      const profile = await profileRes.json()
      created = await createSpotifyPlaylist(token, profile.id, playlistName, description, finalTracks)
    } else {
      created = await createTidalPlaylist(token, playlistName, description, finalTracks)
    }

    const { data: playlistRecord } = await supabase
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

    // Save recommended tracks and link them to the new playlist
    if (playlistRecord) {
      const trackRows = finalTracks.map((track) => ({
        title: track.title,
        artist: track.artist,
        album: track.album,
        source: track.source,
        discovered_by: agent,
        discovered_at: new Date().toISOString(),
        prompt_name: promptName,
        playlist_id: playlistRecord.id,
        release_date: track.releaseDate ?? null,
      }))
      await supabase.from('tracks').insert(trackRows)
    }

    await supabase
      .from('agent_runs')
      .update({
        status: 'completed',
        tracks_found: candidateMap.size,
        tracks_matched: finalTracks.length,
        completed_at: new Date().toISOString(),
      })
      .eq('id', run.id)

    return NextResponse.json({
      run_id: run.id,
      status: 'completed',
      playlist: created,
      recent_only: recent.length >= targetTrackCount,
      queries,
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
