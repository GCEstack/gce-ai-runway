import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient, getAuthenticatedUser } from '@/lib/supabase/server'
import { getSpotifyPlaylistExists, getTidalPlaylistExists } from '@/lib/music'
import { getBeatportAccessToken } from '@/lib/beatport-auth'

async function getBeatportChartExists(token: string, chartId: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.beatport.com/v4/catalog/charts/${chartId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    return res.ok
  } catch (e) {
    console.error('[Beatport] chart exists error:', e)
    return false
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createServiceClient()

  const { user } = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { id } = body as { id?: string }

  let query = supabase.from('playlists').select('*').eq('status', 'active')
    .eq('user_id', user.id)
  if (id) query = query.eq('id', id)

  const { data: playlists, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const tokens: Record<string, string> = {}
  const results: { id: string; external_id: string | null; service: string; exists: boolean; status: string }[] = []

  for (const playlist of playlists || []) {
    if (!playlist.external_id) {
      results.push({ id: playlist.id, external_id: null, service: playlist.service, exists: false, status: playlist.status })
      continue
    }

    const service = playlist.service as 'spotify' | 'tidal' | 'beatport'
    if (!tokens[service]) {
      let token = ''
      if (service === 'beatport') {
        token = (await getBeatportAccessToken(user.id, supabase)) || ''
      } else {
        const { data: tokenRow } = await supabase
          .from('user_tokens')
          .select('access_token')
          .eq('user_id', user.id)
          .eq('service', service)
          .single()
        token = tokenRow?.access_token || ''
      }
      tokens[service] = token
    }

    let exists = false
    if (tokens[service]) {
      if (service === 'spotify') {
        exists = await getSpotifyPlaylistExists(tokens[service], playlist.external_id)
      } else if (service === 'tidal') {
        exists = await getTidalPlaylistExists(tokens[service], playlist.external_id)
      } else {
        exists = await getBeatportChartExists(tokens[service], playlist.external_id)
      }
    }

    const newStatus = exists ? 'active' : 'deleted'
    if (!exists) {
      await supabase
        .from('playlists')
        .update({ status: 'deleted', updated_at: new Date().toISOString() })
        .eq('id', playlist.id)
    }

    results.push({
      id: playlist.id,
      external_id: playlist.external_id,
      service,
      exists,
      status: newStatus,
    })
  }

  return NextResponse.json({ synced: results.length, results })
}
