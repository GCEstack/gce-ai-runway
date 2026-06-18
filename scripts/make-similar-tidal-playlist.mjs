import fs from 'fs'
import path from 'path'
import os from 'os'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const TIDAL_API = 'https://openapi.tidal.com/v2'

// User ID is required because playlists.user_id is NOT NULL.
// Pass via --user-id=<uuid> or set RUNWAY_USER_ID env var.
const args = process.argv.slice(2)
const userIdArg = args.find((a) => a.startsWith('--user-id='))?.split('=')[1]
const USER_ID = userIdArg || process.env.RUNWAY_USER_ID

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required env vars: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!USER_ID) {
  console.error('Missing user_id. Pass --user-id=<uuid> or set RUNWAY_USER_ID.')
  process.exit(1)
}
const TIDAL_HDR = 'application/vnd.api+json'

// Load Tidal token from MCP tokens file
const tokenPath = path.join(os.homedir(), '.tidal-mcp-tokens.json')
const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'))
const tidalToken = tokens.accessToken

const threeMonthsAgo = new Date()
threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

async function supabaseRequest(endpoint, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text}`)
  return text ? JSON.parse(text) : null
}

async function tidalRequest(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${tidalToken}`,
      Accept: TIDAL_HDR,
      ...(options.body ? { 'Content-Type': TIDAL_HDR } : {}),
      ...options.headers,
    },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Tidal ${res.status}: ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : null
}

function parseReleaseDate(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? null : d
}

// 1. Get latest Tidal playlist from Supabase
const playlists = await supabaseRequest('playlists?select=*&service=eq.tidal&order=created_at.desc&limit=1')
if (!playlists?.length) throw new Error('No Tidal playlists found')
const sourcePlaylist = playlists[0]
console.log('Source playlist:', sourcePlaylist.name, sourcePlaylist.external_id)

// 2. Get tracks from source playlist via Tidal API to build artist query
let query = sourcePlaylist.name
let sourceTrackArtists = []
try {
  const playlistTracks = await tidalRequest(`${TIDAL_API}/playlists/${sourcePlaylist.external_id}/relationships/tracks?countryCode=US`)
  const included = playlistTracks.included?.filter(i => i.type === 'tracks') ?? []
  sourceTrackArtists = [...new Set(included.map(t => t.attributes?.artist?.name).filter(Boolean))].slice(0, 3)
  if (sourceTrackArtists.length) query = `${sourceTrackArtists.join(' ')} ${sourcePlaylist.name}`
} catch (e) {
  console.log('Could not fetch source tracks, using playlist name only:', e.message)
}

// 3. Search Tidal for similar tracks
console.log('Searching Tidal for:', query)
const searchRes = await tidalRequest(`${TIDAL_API}/search?query=${encodeURIComponent(query)}&countryCode=US&include=tracks&limit=50`)
const allTracks = searchRes.included?.filter(i => i.type === 'tracks') ?? []

// 4. Filter by release date in past 3 months, dedupe, take 20
const seen = new Set()
const recentTracks = []
for (const item of allTracks) {
  const attrs = item.attributes ?? {}
  const releaseDate = parseReleaseDate(attrs.releaseDate || attrs.release_date || attrs.album?.releaseDate)
  if (!releaseDate || releaseDate < threeMonthsAgo) continue
  const artist = attrs.artist?.name ?? attrs.artists?.[0]?.name ?? 'Unknown'
  const title = attrs.title ?? 'Unknown'
  const key = `${title.toLowerCase()}|${artist.toLowerCase()}`
  if (seen.has(key)) continue
  seen.add(key)
  recentTracks.push({ id: item.id, title, artist, releaseDate })
  if (recentTracks.length >= 20) break
}

console.log(`Found ${recentTracks.length} tracks from past 3 months`)
if (recentTracks.length === 0) {
  console.log('No recent tracks found. Try broadening the search.')
  process.exit(0)
}

// 5. Create new Tidal playlist
const newName = `Similar_to_${sourcePlaylist.name}_Recent`.slice(0, 100)
const createRes = await tidalRequest(`${TIDAL_API}/playlists`, {
  method: 'POST',
  body: JSON.stringify({
    data: {
      type: 'playlists',
      attributes: { name: newName, description: `Runway: 20 similar tracks from the past 3 months based on ${sourcePlaylist.name}` },
    },
  }),
})
const newPlaylistId = createRes.data?.id
if (!newPlaylistId) throw new Error('Tidal did not return playlist id')
console.log('Created Tidal playlist:', newPlaylistId)

// 6. Add tracks
const trackData = recentTracks.map(t => ({ type: 'tracks', id: t.id }))
await tidalRequest(`${TIDAL_API}/playlists/${newPlaylistId}/relationships/tracks`, {
  method: 'POST',
  body: JSON.stringify({ data: trackData }),
})
console.log(`Added ${recentTracks.length} tracks`)

// 7. Record in Supabase
await supabaseRequest('playlists', {
  method: 'POST',
  body: JSON.stringify({
    name: newName,
    agent: 'CLAUDE',
    service: 'tidal',
    external_id: newPlaylistId,
    track_count: recentTracks.length,
    prompt_name: `similar:${sourcePlaylist.name}`,
    user_id: USER_ID,
  }),
})

console.log('Done! Playlist URL:', `https://tidal.com/browse/playlist/${newPlaylistId}`)
