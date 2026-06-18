// Beatport API client for Runway
// Beatport v4 API: https://api.beatport.com/v4

const BEATPORT_API = 'https://api.beatport.com/v4'

export interface BeatportTrack {
  id: number
  name: string
  mix_name: string | null
  artists: Array<{ name: string; id: number }>
  release: { name: string; publish_date: string; id: number }
  genre: { name: string; id: number }
  bpm: number | null
  key: { camelot_number: number; letter: string } | null
  slug: string | null
}

export interface BeatportChart {
  id: number
  name: string
  description: string | null
  track_count: number
  slug: string | null
}

// Import DiscoveredTrack from music.ts to match the shape
import type { DiscoveredTrack } from './music'

function formatBeatportTitle(track: BeatportTrack): string {
  const name = track.name ?? 'Unknown'
  const mix = track.mix_name
  if (mix && mix !== 'Original Mix') {
    return `${name} (${mix})`
  }
  return name
}

// ── Search ──────────────────────────────────────────────────────────────────

export async function searchBeatport(
  token: string,
  query: string,
  limit: number
): Promise<DiscoveredTrack[]> {
  const results: DiscoveredTrack[] = []
  try {
    const url = `${BEATPORT_API}/catalog/tracks?q=${encodeURIComponent(query)}&per_page=${limit}`
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })
    if (!res.ok) throw new Error(`Beatport API ${res.status}`)
    const data = await res.json()
    for (const item of data.tracks ?? []) {
      results.push({
        title: formatBeatportTitle(item),
        artist: item.artists?.map((a: any) => a.name).join(', ') ?? 'Unknown',
        album: item.release?.name ?? 'Unknown',
        source: 'beatport',
        track_id: item.id.toString(),
        url: `https://www.beatport.com/track/${item.id}`,
        releaseDate: item.release?.publish_date,
      })
    }
  } catch (e) {
    console.error('[Music] Beatport search error:', e)
  }
  return results
}

// ── Charts ──────────────────────────────────────────────────────────────────

export async function getBeatportCharts(
  token: string,
  limit: number = 50
): Promise<BeatportChart[]> {
  const results: BeatportChart[] = []
  try {
    const url = `${BEATPORT_API}/catalog/charts?per_page=${limit}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`Beatport charts ${res.status}`)
    const data = await res.json()
    for (const item of data.charts ?? []) {
      results.push({
        id: item.id,
        name: item.name,
        description: item.description,
        track_count: item.track_count ?? 0,
        slug: item.slug,
      })
    }
  } catch (e) {
    console.error('[Music] Beatport charts error:', e)
  }
  return results
}

export async function getBeatportChartTracks(
  token: string,
  chartId: string
): Promise<DiscoveredTrack[]> {
  const results: DiscoveredTrack[] = []
  try {
    const url = `${BEATPORT_API}/catalog/charts/${chartId}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`Beatport chart tracks ${res.status}`)
    const data = await res.json()
    for (const item of data.tracks ?? []) {
      results.push({
        title: formatBeatportTitle(item),
        artist: item.artists?.map((a: any) => a.name).join(', ') ?? 'Unknown',
        album: item.release?.name ?? 'Unknown',
        source: 'beatport',
        track_id: item.id.toString(),
        url: `https://www.beatport.com/track/${item.id}`,
        releaseDate: item.release?.publish_date,
      })
    }
  } catch (e) {
    console.error('[Music] Beatport chart tracks error:', e)
  }
  return results
}

// ── Track details ───────────────────────────────────────────────────────────

export async function getBeatportTrack(
  token: string,
  trackId: string
): Promise<DiscoveredTrack | null> {
  try {
    const url = `${BEATPORT_API}/catalog/tracks/${trackId}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`Beatport track ${res.status}`)
    const data = await res.json()
    const item = data.track ?? data
    return {
      title: formatBeatportTitle(item),
      artist: item.artists?.map((a: any) => a.name).join(', ') ?? 'Unknown',
      album: item.release?.name ?? 'Unknown',
      source: 'beatport',
      track_id: item.id.toString(),
      url: `https://www.beatport.com/track/${item.id}`,
      releaseDate: item.release?.publish_date,
    }
  } catch (e) {
    console.error('[Music] Beatport track error:', e)
    return null
  }
}

// ── Playlist creation (NOT supported by Beatport API) ───────────────────────
// Beatport does not have a user playlist creation API.
// Tracks discovered on Beatport are saved to Supabase only.
// For playlist creation, use Tidal or Spotify.

export function createBeatportPlaylist(): never {
  throw new Error(
    'Beatport does not support playlist creation via API. ' +
      'Create playlists on Tidal or Spotify instead, or save tracks to Supabase only.'
  )
}
