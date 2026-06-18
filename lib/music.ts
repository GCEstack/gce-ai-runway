// Shared helpers for Spotify / Tidal REST APIs

const TIDAL_API = 'https://openapi.tidal.com/v2'
const TIDAL_HDR = 'application/vnd.api+json'

export interface DiscoveredTrack {
  title: string
  artist: string
  album: string
  source: 'spotify' | 'tidal' | 'beatport'
  track_id: string
  url: string
  releaseDate?: string
}

export interface CreatedPlaylist {
  id: string
  name: string
  url: string
  track_count: number
}

export function deduplicateTracks(tracks: DiscoveredTrack[]): DiscoveredTrack[] {
  const seen = new Set<string>()
  const unique: DiscoveredTrack[] = []
  for (const track of tracks) {
    const key = `${track.title.toLowerCase()}|${track.artist.toLowerCase()}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(track)
    }
  }
  return unique
}

function parseTidalTrack(item: any, included: any[] = []): DiscoveredTrack | null {
  const attrs = item?.attributes ?? {}
  const title = attrs.title
  if (!title) return null

  const rels = item?.relationships ?? {}
  const artistIds: string[] = (rels.artists?.data ?? []).map((d: any) => d.id)
  const artist = artistIds.length
    ? included.find((i: any) => i.type === 'artists' && artistIds.includes(i.id))?.attributes?.name
    : attrs.artist?.name ?? attrs.artists?.[0]?.name ?? 'Unknown'

  const albumId = rels.albums?.data?.[0]?.id
  const album = albumId
    ? included.find((i: any) => i.type === 'albums' && i.id === albumId)
    : undefined

  return {
    title,
    artist: artist ?? 'Unknown',
    album: album?.attributes?.title ?? attrs.album?.title ?? 'Unknown',
    source: 'tidal',
    track_id: item.id,
    url: `https://tidal.com/browse/track/${item.id}`,
    releaseDate:
      album?.attributes?.releaseDate ??
      attrs.releaseDate ??
      attrs.release_date ??
      attrs.album?.releaseDate ??
      undefined,
  }
}

// ── Search ──────────────────────────────────────────────────────────────────

export async function searchSpotify(token: string, query: string, limit: number): Promise<DiscoveredTrack[]> {
  const results: DiscoveredTrack[] = []
  try {
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error(`Spotify API ${res.status}`)
    const data = await res.json()
    for (const item of data.tracks?.items ?? []) {
      results.push({
        title: item.name,
        artist: item.artists?.[0]?.name ?? 'Unknown',
        album: item.album?.name ?? 'Unknown',
        source: 'spotify',
        track_id: item.id,
        url: item.external_urls?.spotify ?? `https://open.spotify.com/track/${item.id}`,
        releaseDate: item.album?.release_date,
      })
    }
  } catch (e) {
    console.error('[Music] Spotify search error:', e)
  }
  return results
}

export async function searchTidal(token: string, query: string, limit: number): Promise<DiscoveredTrack[]> {
  const results: DiscoveredTrack[] = []
  try {
    const encodedQuery = encodeURIComponent(query)
    // Use lowercase 'searchresults' — Tidal's reference shows mixed case but
    // working community examples and some environments require lowercase.
    const url = `${TIDAL_API}/searchresults/${encodedQuery}?countryCode=US&include=tracks,tracks.artists,tracks.albums&limit=${limit}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: TIDAL_HDR },
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`Tidal API ${res.status}: ${errText.slice(0, 200)}`)
    }
    const data = await res.json()
    // Tidal may return tracks as primary data or in included; check both.
    const included: any[] = data.included ?? []
    const primary: any[] = data.data ?? []
    const trackItems = [
      ...included.filter((i: any) => i.type === 'tracks'),
      ...primary.filter((i: any) => i.type === 'tracks'),
    ]
    console.log(`[Music] Tidal search "${query}" response primary=${primary.length} included=${included.length} tracks=${trackItems.length}`)
    for (const item of trackItems) {
      const track = parseTidalTrack(item, included)
      if (track) results.push(track)
    }
  } catch (e) {
    console.error('[Music] Tidal search error:', e)
  }
  return results
}

// ── Playlist tracks ─────────────────────────────────────────────────────────

export async function getSpotifyPlaylistTracks(token: string, playlistId: string): Promise<DiscoveredTrack[]> {
  const results: DiscoveredTrack[] = []
  try {
    let url: string | null = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`
    while (url) {
      const res: Response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error(`Spotify playlist tracks ${res.status}`)
      const data: any = await res.json()
      for (const item of data.items ?? []) {
        const track = item.track
        if (!track) continue
        results.push({
          title: track.name,
          artist: track.artists?.[0]?.name ?? 'Unknown',
          album: track.album?.name ?? 'Unknown',
          source: 'spotify',
          track_id: track.id,
          url: track.external_urls?.spotify ?? `https://open.spotify.com/track/${track.id}`,
          releaseDate: track.album?.release_date,
        })
      }
      url = data.next
    }
  } catch (e) {
    console.error('[Music] Spotify playlist tracks error:', e)
  }
  return results
}

export async function getTidalPlaylistTracks(token: string, playlistId: string): Promise<DiscoveredTrack[]> {
  const results: DiscoveredTrack[] = []
  try {
    const base = `${TIDAL_API}/playlists/${playlistId}/relationships/items?countryCode=US&include=items.artists,items.albums`
    let url: string | null = `${base}&limit=50`
    while (url) {
      const res: Response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: TIDAL_HDR },
      })
      if (!res.ok) throw new Error(`Tidal playlist tracks ${res.status}`)
      const data = await res.json()
      const refs: any[] = data.data ?? []
      const included: any[] = data.included ?? []

      for (const ref of refs) {
        const track = included.find((i: any) => i.type === 'tracks' && i.id === ref.id)
        if (!track) continue

        const attrs = track.attributes ?? {}
        const rels = track.relationships ?? {}
        const artistIds: string[] = (rels.artists?.data ?? []).map((d: any) => d.id)
        const artists: any[] = included.filter(
          (i: any) => i.type === 'artists' && artistIds.includes(i.id)
        )
        const artistName = artists[0]?.attributes?.name ?? 'Unknown'

        const albumId = rels.albums?.data?.[0]?.id
        const album = albumId ? included.find((i: any) => i.type === 'albums' && i.id === albumId) : undefined
        const albumTitle = album?.attributes?.title ?? 'Unknown'
        const releaseDate = album?.attributes?.releaseDate ?? undefined

        if (attrs.title) {
          results.push({
            title: attrs.title,
            artist: artistName,
            album: albumTitle,
            source: 'tidal',
            track_id: track.id,
            url: `https://tidal.com/browse/track/${track.id}`,
            releaseDate,
          })
        }
      }

      const nextCursor = data.links?.meta?.nextCursor
      if (nextCursor) {
        url = `${base}&limit=50&page%5Bcursor%5D=${encodeURIComponent(nextCursor)}`
      } else if (typeof data.links?.next === 'string') {
        url = data.links.next
      } else {
        url = null
      }
    }
  } catch (e) {
    console.error('[Music] Tidal playlist tracks error:', e)
  }
  return results
}

export async function getSpotifyPlaylistExists(token: string, playlistId: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    return res.ok
  } catch (e) {
    console.error('[Music] Spotify playlist exists error:', e)
    return false
  }
}

export async function getTidalPlaylistExists(token: string, playlistId: string): Promise<boolean> {
  try {
    const res = await fetch(`${TIDAL_API}/playlists/${playlistId}?countryCode=US`, {
      headers: { Authorization: `Bearer ${token}`, Accept: TIDAL_HDR },
    })
    return res.ok
  } catch (e) {
    console.error('[Music] Tidal playlist exists error:', e)
    return false
  }
}

// ── Playlist creation ───────────────────────────────────────────────────────

export async function createSpotifyPlaylist(
  token: string,
  userId: string,
  name: string,
  description: string,
  tracks: DiscoveredTrack[]
): Promise<CreatedPlaylist> {
  // Create playlist
  const createRes = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, description, public: false }),
  })
  if (!createRes.ok) throw new Error(`Spotify create playlist ${createRes.status}`)
  const playlist = await createRes.json()

  // Add tracks in chunks of 100
  const spotifyTracks = tracks.filter((t) => t.source === 'spotify')
  const uris = spotifyTracks.map((t) => `spotify:track:${t.track_id}`)
  for (let i = 0; i < uris.length; i += 100) {
    await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uris: uris.slice(i, i + 100) }),
    })
  }

  return {
    id: playlist.id,
    name: playlist.name,
    url: playlist.external_urls?.spotify ?? `https://open.spotify.com/playlist/${playlist.id}`,
    track_count: spotifyTracks.length,
  }
}

export async function createTidalPlaylist(
  token: string,
  name: string,
  description: string,
  tracks: DiscoveredTrack[]
): Promise<CreatedPlaylist> {
  // Create playlist
  const createRes = await fetch(`${TIDAL_API}/playlists`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: TIDAL_HDR,
      'Content-Type': TIDAL_HDR,
    },
    body: JSON.stringify({
      data: {
        type: 'playlists',
        attributes: { name, description },
      },
    }),
  })
  if (!createRes.ok) {
    const errText = await createRes.text().catch(() => '')
    throw new Error(`Tidal create playlist ${createRes.status}: ${errText.slice(0, 200)}`)
  }
  const createData = await createRes.json()
  const playlistId = createData.data?.id
  if (!playlistId) throw new Error('Tidal did not return playlist id')

  // Add tracks via playlist items relationship
  const tidalTracks = tracks.filter((t) => t.source === 'tidal')
  if (tidalTracks.length > 0) {
    const trackData = tidalTracks.map((t) => ({ type: 'tracks', id: t.track_id }))
    const addRes = await fetch(`${TIDAL_API}/playlists/${playlistId}/relationships/items?countryCode=US`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: TIDAL_HDR,
        'Content-Type': TIDAL_HDR,
      },
      body: JSON.stringify({ data: trackData }),
    })
    if (!addRes.ok) {
      const errText = await addRes.text().catch(() => '')
      throw new Error(`Tidal add tracks ${addRes.status}: ${errText.slice(0, 200)}`)
    }
  }

  return {
    id: playlistId,
    name,
    url: `https://tidal.com/browse/playlist/${playlistId}`,
    track_count: tidalTracks.length,
  }
}

// Re-export Beatport helpers
export { searchBeatport, getBeatportCharts, getBeatportChartTracks, getBeatportTrack } from './beatport'
export type { BeatportTrack, BeatportChart } from './beatport'
