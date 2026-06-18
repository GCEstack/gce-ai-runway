import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient, getAuthenticatedUser } from '@/lib/supabase/server'
import { getBeatportAccessToken } from '@/lib/beatport-auth'
import type { Service } from '@/lib/types'

const TIDAL_API = 'https://openapi.tidal.com/v2'
const TIDAL_HDR = 'application/vnd.api+json'
const TIDAL_CLIENT_ID = process.env.TIDAL_CLIENT_ID ?? ''
const TIDAL_CLIENT_SECRET = process.env.TIDAL_CLIENT_SECRET ?? ''

// ── Spotify helpers ───────────────────────────────────────────────────────────

async function fetchSpotifyPlaylists(token: string) {
  const playlists: any[] = []
  let url: string | null = 'https://api.spotify.com/v1/me/playlists?limit=50'
  while (url) {
    const res: Response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error(`Spotify API ${res.status}`)
    const data = await res.json()
    playlists.push(...(data.items ?? []))
    url = data.next ?? null
  }
  return playlists
}

// ── Tidal helpers ─────────────────────────────────────────────────────────────

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  { retries = 3, retryOn = [429, 500, 502, 503, 504] }: { retries?: number; retryOn?: number[] } = {}
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, init)
    if (res.ok || !retryOn.includes(res.status) || attempt === retries) {
      return res
    }
    const delay = Math.min(1000 * Math.pow(2, attempt), 8000)
    console.warn(`[tidal/sync] retry ${url} after ${res.status}, waiting ${delay}ms`)
    await sleep(delay)
  }
  return fetch(url, init)
}

async function refreshTidalToken(supabase: Awaited<ReturnType<typeof createServiceClient>>, userId: string) {
  if (!TIDAL_CLIENT_ID || !TIDAL_CLIENT_SECRET) {
    console.error('[tidal/sync] TIDAL_CLIENT_ID or TIDAL_CLIENT_SECRET missing; cannot refresh')
    return null
  }

  const { data: row } = await supabase
    .from('user_tokens')
    .select('refresh_token')
    .eq('user_id', userId)
    .eq('service', 'tidal')
    .single()

  if (!row?.refresh_token) {
    console.error('[tidal/sync] No refresh_token available')
    return null
  }

  const res = await fetch('https://auth.tidal.com/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: row.refresh_token,
      client_id: TIDAL_CLIENT_ID,
      client_secret: TIDAL_CLIENT_SECRET,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error('[tidal/sync] Refresh failed:', res.status, body)
    return null
  }

  const data = await res.json()
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString()

  await supabase
    .from('user_tokens')
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? row.refresh_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('service', 'tidal')

  console.log('[tidal/sync] Token refreshed')
  return data.access_token as string
}

function parseTidalDate(attrs: any): string | null {
  const raw = attrs?.createdAt ?? attrs?.lastUpdated ?? attrs?.created_at ?? attrs?.last_updated ?? null
  if (!raw) return null
  try {
    const d = new Date(raw)
    if (isNaN(d.getTime())) return null
    return d.toISOString()
  } catch {
    return null
  }
}

async function fetchTidalPlaylists(token: string, tidalUserId: string, syncAfterDate?: string): Promise<any[] | null> {
  const ids: string[] = []
  let cursor: string | null = null
  let attempts = 0

  // Step 1: collect all playlist UUIDs from userCollections
  do {
    const paramObj: Record<string, string> = { countryCode: 'US' }
    if (cursor) paramObj['page[cursor]'] = cursor
    const params = new URLSearchParams(paramObj)
    const res = await fetchWithRetry(
      `${TIDAL_API}/userCollections/${tidalUserId}/relationships/playlists?${params}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: TIDAL_HDR } },
      { retries: 2, retryOn: [429, 500, 502, 503, 504] }
    )

    if (res.status === 401) {
      console.error('[tidal/sync] userCollections returned 401')
      return null
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Tidal userCollections ${res.status}: ${body.slice(0, 200)}`)
    }

    const data = await res.json()
    ids.push(...(data.data ?? []).map((d: any) => d.id))
    cursor = data.links?.meta?.nextCursor ?? null
    attempts++
    if (cursor && attempts % 2 === 0) await sleep(500)
  } while (cursor)

  // Step 2: fetch metadata for each playlist (batched with delay to avoid 429)
  const BATCH = 5
  const DELAY = 600
  const results: any[] = []
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH)
    const settled = await Promise.allSettled(
      batch.map((id) =>
        fetchWithRetry(`${TIDAL_API}/playlists/${id}?countryCode=US`, {
          headers: { Authorization: `Bearer ${token}`, Accept: TIDAL_HDR },
        }).then((r) => (r.ok ? r.json() : null))
      )
    )
    settled.forEach((r) => {
      if (r.status === 'fulfilled' && r.value?.data) {
        const pl = r.value.data
        const externalCreatedAt = parseTidalDate(pl.attributes)
        if (syncAfterDate && externalCreatedAt && externalCreatedAt < syncAfterDate) {
          console.log('[tidal/sync] skipping playlist older than sync_after_date:', pl.id)
          return
        }
        results.push(pl)
      }
    })
    if (i + BATCH < ids.length) await sleep(DELAY)
  }
  return results
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createServiceClient()
  const { user } = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const { service, access_token, tidal_user_id, sync_after_date } = (body ?? {}) as {
    service: Service
    access_token?: string
    tidal_user_id?: string
    sync_after_date?: string
  }

  if (!service || !['spotify', 'tidal', 'beatport'].includes(service)) {
    return NextResponse.json({ error: 'service must be spotify, tidal, or beatport' }, { status: 400 })
  }

  // Resolve token: body > stored user_token > error
  let token = access_token
  let tidalUserId = tidal_user_id

  if (!token) {
    const { data: stored } = await supabase
      .from('user_tokens')
      .select('access_token, refresh_token, service_user_id')
      .eq('user_id', user.id)
      .eq('service', service)
      .single()
    if (!stored) {
      return NextResponse.json(
        { error: `No ${service} token found. Connect your account in Settings.` },
        { status: 400 }
      )
    }
    token = stored.access_token
    if (!tidalUserId && stored.service_user_id) tidalUserId = stored.service_user_id
  }

  if (!token) return NextResponse.json({ error: 'No token available' }, { status: 400 })

  if (service === 'beatport') {
    const refreshed = await getBeatportAccessToken(user.id, supabase)
    if (refreshed) token = refreshed
  }

  try {
    let upserted = 0
    let markedDeleted = 0
    const foundExternalIds = new Set<string>()

    if (service === 'spotify') {
      const playlists = await fetchSpotifyPlaylists(token)
      for (const pl of playlists) {
        foundExternalIds.add(pl.id)
        const { error } = await supabase.from('playlists').upsert(
          {
            name:        pl.name,
            agent:       (pl.name ?? '').startsWith('CLAUDE') ? 'CLAUDE' : 'KIMI',
            service:     'spotify',
            external_id: pl.id,
            track_count: pl.tracks?.total ?? 0,
            prompt_name: null,
            status:      'active',
            user_id:     user.id,
          },
          { onConflict: 'user_id,service,external_id' }
        )
        if (!error) upserted++
      }
    }

    if (service === 'tidal') {
      if (!tidalUserId) return NextResponse.json({ error: 'tidal_user_id required' }, { status: 400 })

      let playlists = await fetchTidalPlaylists(token, tidalUserId, sync_after_date)

      // If we got a 401, try refreshing the token once and retry.
      if (playlists === null) {
        console.log('[tidal/sync] Attempting token refresh')
        const refreshed = await refreshTidalToken(supabase, user.id)
        if (!refreshed) {
          return NextResponse.json(
            { error: 'Tidal token expired or invalid. Please reconnect Tidal in Settings.' },
            { status: 401 }
          )
        }
        token = refreshed
        playlists = await fetchTidalPlaylists(token, tidalUserId)
        if (playlists === null) {
          return NextResponse.json(
            { error: 'Tidal userCollections returned 401 after refresh.' },
            { status: 401 }
          )
        }
      }

      for (const pl of playlists) {
        const a = pl.attributes ?? {}
        const externalCreatedAt = parseTidalDate(a)
        foundExternalIds.add(pl.id)
        const { error } = await supabase.from('playlists').upsert(
          {
            name:                 a.name ?? '',
            agent:                (a.name ?? '').startsWith('CLAUDE') ? 'CLAUDE' : 'KIMI',
            service:              'tidal',
            external_id:          pl.id,
            track_count:          a.numberOfItems ?? 0,
            prompt_name:          null,
            status:               'active',
            user_id:              user.id,
            external_created_at:  externalCreatedAt,
          },
          { onConflict: 'user_id,service,external_id' }
        )
        if (!error) upserted++
      }
    }

    if (service === 'beatport') {
      const {
        getBeatportUserPlaylists,
        getBeatportChartsByGenre,
        getBeatportUser,
      } = await import('@/lib/beatport')

      // Fetch user info to store username
      const bpUser = await getBeatportUser(token)
      if (bpUser?.username) {
        await supabase
          .from('user_tokens')
          .update({ service_user_id: bpUser.username })
          .eq('user_id', user.id)
          .eq('service', 'beatport')
      }

      // 1. Fetch user's My Beatport playlists
      const userPlaylists = await getBeatportUserPlaylists(token)
      for (const pl of userPlaylists) {
        const externalId = `mybeatport-${pl.id}`
        foundExternalIds.add(externalId)
        const { error } = await supabase.from('playlists').upsert(
          {
            name: pl.name,
            agent: 'KIMI',
            service: 'beatport',
            external_id: externalId,
            track_count: pl.track_count ?? 0,
            prompt_name: null,
            status: 'active',
            user_id: user.id,
          },
          { onConflict: 'user_id,service,external_id' }
        )
        if (!error) upserted++
      }

      // 2. Fetch genre charts from user's preferences
      const { data: bpTokenRow } = await supabase
        .from('user_tokens')
        .select('preferences')
        .eq('user_id', user.id)
        .eq('service', 'beatport')
        .single()

      const preferredGenres = (bpTokenRow?.preferences as { genres?: Array<{ id: number; name: string }> } | null)?.genres ?? []
      const genresToSync = preferredGenres.length > 0 ? preferredGenres : []

      for (const genre of genresToSync) {
        const charts = await getBeatportChartsByGenre(token, genre.id, 10)
        for (const ch of charts) {
          const externalId = `genre-${genre.id}-${ch.id}`
          foundExternalIds.add(externalId)
          const { error } = await supabase.from('playlists').upsert(
            {
              name: `${genre.name}: ${ch.name}`,
              agent: 'KIMI',
              service: 'beatport',
              external_id: externalId,
              track_count: ch.track_count ?? 0,
              prompt_name: null,
              status: 'active',
              user_id: user.id,
            },
            { onConflict: 'user_id,service,external_id' }
          )
          if (!error) upserted++
        }
      }

      // 3. If no preferences set, also fetch a few default popular genre charts
      if (genresToSync.length === 0) {
        // Default genres: Melodic House & Techno (id varies), Techno, etc.
        // Try common genre IDs - these are Beatport genre IDs
        const defaultGenres = [
          { id: 1, name: 'Melodic House & Techno' },  // common id
          { id: 11, name: 'Techno' },
        ]
        for (const genre of defaultGenres) {
          try {
            const charts = await getBeatportChartsByGenre(token, genre.id, 5)
            for (const ch of charts) {
              const externalId = `genre-${genre.id}-${ch.id}`
              foundExternalIds.add(externalId)
              const { error } = await supabase.from('playlists').upsert(
                {
                  name: `${genre.name}: ${ch.name}`,
                  agent: 'KIMI',
                  service: 'beatport',
                  external_id: externalId,
                  track_count: ch.track_count ?? 0,
                  prompt_name: null,
                  status: 'active',
                  user_id: user.id,
                },
                { onConflict: 'user_id,service,external_id' }
              )
              if (!error) upserted++
            }
          } catch (e) {
            console.log(`[beatport/sync] Default genre ${genre.id} failed, likely invalid ID`)
          }
        }
      }
    }

    // Mark active playlists in Supabase that were not returned by the service as deleted
    const { data: activePlaylists } = await supabase
      .from('playlists')
      .select('id, external_id')
      .eq('service', service)
      .eq('status', 'active')
      .eq('user_id', user.id)

    for (const row of activePlaylists ?? []) {
      if (row.external_id && !foundExternalIds.has(row.external_id)) {
        const { error } = await supabase
          .from('playlists')
          .update({ status: 'deleted', updated_at: new Date().toISOString() })
          .eq('id', row.id)
        if (!error) markedDeleted++
      }
    }

    return NextResponse.json({ synced: upserted, marked_deleted: markedDeleted, service })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[tidal/sync] unhandled error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
