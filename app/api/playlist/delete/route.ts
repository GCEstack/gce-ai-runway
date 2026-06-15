import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const TIDAL_API = 'https://openapi.tidal.com/v2'
const TIDAL_HDR = 'application/vnd.api+json'

export async function POST(request: NextRequest) {
  const supabase = await createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const { id } = body as { id?: string }
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { data: playlist, error: fetchError } = await supabase
    .from('playlists')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !playlist) {
    return NextResponse.json({ error: 'Playlist not found' }, { status: 404 })
  }

  if (playlist.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Try to delete from service first (best effort)
  if (playlist.external_id) {
    const { data: tokenRow } = await supabase
      .from('user_tokens')
      .select('access_token')
      .eq('user_id', user.id)
      .eq('service', playlist.service)
      .single()

    if (tokenRow?.access_token) {
      try {
        if (playlist.service === 'spotify') {
          // Spotify doesn't support playlist deletion via API; unfollow is the closest
          await fetch(`https://api.spotify.com/v1/playlists/${playlist.external_id}/followers`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${tokenRow.access_token}` },
          })
        } else if (playlist.service === 'tidal') {
          await fetch(`${TIDAL_API}/playlists/${playlist.external_id}?countryCode=US`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${tokenRow.access_token}`,
              Accept: TIDAL_HDR,
            },
          })
        }
      } catch (e) {
        console.error('[playlist/delete] service delete error:', e)
      }
    }
  }

  const { error } = await supabase
    .from('playlists')
    .update({ status: 'deleted', updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, status: 'deleted' })
}
