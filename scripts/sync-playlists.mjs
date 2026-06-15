#!/usr/bin/env node
/**
 * Local sync — reads the local Spotify token file and upserts playlists to Supabase.
 * Tidal is now connected via the dashboard, so use Settings → Sync now for Tidal.
 * Usage:
 *   node scripts/sync-playlists.mjs --spotify
 *   node scripts/sync-playlists.mjs --all
 */
import fs from 'fs'
import path from 'path'
import os from 'os'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SVC_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const args = process.argv.slice(2)
const doSpotify = args.includes('--spotify') || args.includes('--all')

if (!doSpotify) {
  console.error('Usage: node scripts/sync-playlists.mjs [--spotify] [--all]')
  console.error('Note: Tidal sync is now handled from the Runway dashboard.')
  process.exit(1)
}

if (!SUPABASE_URL || !SUPABASE_SVC_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
  process.exit(1)
}

function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')) } catch { return null }
}

async function supabaseUpsert(rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/playlists?on_conflict=external_id`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SVC_KEY,
      Authorization: `Bearer ${SUPABASE_SVC_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Supabase upsert failed ${res.status}: ${err}`)
  }
  return rows.length
}

async function refreshSpotify(tokens) {
  if (Date.now() < tokens.expiresAt - 60000) return tokens.accessToken
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET')
  }
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Spotify refresh failed: ${JSON.stringify(data)}`)
  const updated = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? tokens.refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
  fs.writeFileSync(path.join(os.homedir(), '.spotify-mcp-tokens.json'), JSON.stringify(updated, null, 2), { mode: 0o600 })
  return updated.accessToken
}

async function fetchSpotifyPlaylists(token) {
  const playlists = []
  let url = 'https://api.spotify.com/v1/me/playlists?limit=50'
  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error(`Spotify API ${res.status}`)
    const data = await res.json()
    playlists.push(...(data.items ?? []))
    url = data.next ?? null
  }
  return playlists
}

async function main() {
  if (doSpotify) {
    console.log('🎵 Syncing Spotify playlists…')
    const tokens = readJSON(path.join(os.homedir(), '.spotify-mcp-tokens.json'))
    if (!tokens) {
      console.error('  ✗ No Spotify token. Run npm run auth in spotify-mcp-server first.')
      return
    }
    try {
      const token = await refreshSpotify(tokens)
      const playlists = await fetchSpotifyPlaylists(token)
      const rows = playlists.map((pl) => ({
        name: pl.name ?? '',
        agent: (pl.name ?? '').startsWith('KIMI') ? 'KIMI' : 'CLAUDE',
        service: 'spotify',
        external_id: pl.id,
        track_count: pl.tracks?.total ?? 0,
        prompt_name: null,
      }))
      const count = await supabaseUpsert(rows)
      console.log(`  ✅ Synced ${count} Spotify playlists`)
    } catch (e) {
      console.error('  ✗', e.message)
      process.exit(1)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
