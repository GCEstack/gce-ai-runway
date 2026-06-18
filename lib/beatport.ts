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
    const url = `${BEATPORT_API}/catalog/search/?q=${encodeURIComponent(query)}&type=tracks&per_page=${limit}`
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    })
    if (!res.ok) throw new Error(`Beatport API ${res.status}`)
    const data = await res.json()
    const tracks = data.results ?? data.tracks ?? []
    for (const item of tracks) {
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
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`Beatport charts ${res.status}`)
    const data = await res.json()
    const charts = data.results ?? data.charts ?? []
    for (const item of charts) {
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
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`Beatport chart tracks ${res.status}`)
    const data = await res.json()
    const tracks = data.results ?? data.tracks ?? []
    for (const item of tracks) {
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
    const url = `${BEATPORT_API}/catalog/tracks/${trackId}/`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
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

// ── User profile ────────────────────────────────────────────────────────────

export interface BeatportUser {
  username: string
  email: string
  id: string
  first_name: string | null
  last_name: string | null
}

export async function getBeatportUser(token: string): Promise<BeatportUser | null> {
  try {
    const res = await fetch(`${BEATPORT_API}/my/account/`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
    if (res.status === 401) throw new Error('Beatport token expired (401)')
    if (!res.ok) throw new Error(`Beatport my/account ${res.status}`)
    const data = await res.json()
    return {
      username: data.username ?? '',
      email: data.email ?? '',
      id: data.id?.toString() ?? '',
      first_name: data.first_name ?? null,
      last_name: data.last_name ?? null,
    }
  } catch (e) {
    console.error('[Music] Beatport user error:', e)
    return null
  }
}

// ── Genres ───────────────────────────────────────────────────────────────────

export interface BeatportGenre {
  id: number
  name: string
  slug: string
  url: string
}

export async function getBeatportGenres(token: string): Promise<BeatportGenre[]> {
  const results: BeatportGenre[] = []
  try {
    const res = await fetch(`${BEATPORT_API}/catalog/genres?per_page=100`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
    if (res.status === 401) {
      console.error('[Music] Beatport genres 401 — token expired')
      return results
    }
    if (!res.ok) throw new Error(`Beatport genres ${res.status}`)
    const data = await res.json()
    const genres = data.results ?? data.genres ?? []
    for (const item of genres) {
      results.push({
        id: item.id,
        name: item.name,
        slug: item.slug,
        url: `https://www.beatport.com/genre/${item.slug}/${item.id}/`,
      })
    }
  } catch (e) {
    console.error('[Music] Beatport genres error:', e)
  }
  return results
}

// ── Charts by Genre ───────────────────────────────────────────────────────────

export async function getBeatportChartsByGenre(
  token: string,
  genreId: number,
  limit: number = 50
): Promise<BeatportChart[]> {
  const results: BeatportChart[] = []
  try {
    const url = `${BEATPORT_API}/catalog/charts?genre_id=${genreId}&per_page=${limit}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`Beatport charts by genre ${res.status}`)
    const data = await res.json()
    const charts = data.results ?? data.charts ?? []
    for (const item of charts) {
      results.push({
        id: item.id,
        name: item.name,
        description: item.description,
        track_count: item.track_count ?? 0,
        slug: item.slug,
      })
    }
  } catch (e) {
    console.error('[Music] Beatport charts by genre error:', e)
  }
  return results
}

// ── User's playlists (My Beatport collections) ───────────────────────────────

export interface BeatportUserPlaylist {
  id: number
  name: string
  track_count: number
  slug: string | null
  created_at: string | null
}

export async function getBeatportUserPlaylists(
  token: string
): Promise<BeatportUserPlaylist[]> {
  const results: BeatportUserPlaylist[] = []
  try {
    // Beatport's "My Beatport" user collections endpoint
    const url = `${BEATPORT_API}/mybeatport/playlists?per_page=50`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`Beatport user playlists ${res.status}`)
    const data = await res.json()
    for (const item of data.results ?? data.playlists ?? []) {
      results.push({
        id: item.id,
        name: item.name,
        track_count: item.track_count ?? item.tracks?.length ?? 0,
        slug: item.slug,
        created_at: item.created_at ?? null,
      })
    }
  } catch (e) {
    console.error('[Music] Beatport user playlists error:', e)
  }
  return results
}

export async function getBeatportUserPlaylistTracks(
  token: string,
  playlistId: string
): Promise<DiscoveredTrack[]> {
  const results: DiscoveredTrack[] = []
  try {
    const url = `${BEATPORT_API}/mybeatport/playlists/${playlistId}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`Beatport user playlist tracks ${res.status}`)
    const data = await res.json()
    for (const item of data.tracks ?? data.results ?? []) {
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
    console.error('[Music] Beatport user playlist tracks error:', e)
  }
  return results
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
