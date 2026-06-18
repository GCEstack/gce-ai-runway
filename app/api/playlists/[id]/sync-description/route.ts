import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const TIDAL_API = 'https://openapi.tidal.com/v2'
const TIDAL_HDR = 'application/vnd.api+json'

function formatDescription(
  comments: string | null,
  tags: string[] | null,
  energy: string | null,
  rating: number | null
): string {
  const parts: string[] = []
  if (comments?.trim()) parts.push(comments.trim())
  if (tags && tags.length > 0) parts.push(`Tags: ${tags.join(', ')}`)
  if (energy) parts.push(`Energy: ${energy}`)
  if (rating) parts.push(`Rating: ${rating}/5`)
  return parts.join(' • ') || 'Curated with Runway'
}

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  const supabase = await createServiceClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: playlist, error: playlistError } = await supabase
    .from('playlists')
    .select('*')
    .eq('id', id)
    .single()

  if (playlistError || !playlist) {
    return NextResponse.json({ error: 'Playlist not found' }, { status: 404 })
  }

  if (playlist.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (playlist.service !== 'tidal' || !playlist.external_id) {
    return NextResponse.json(
      { error: 'Sync is only supported for Tidal playlists with an external ID' },
      { status: 400 }
    )
  }

  const { data: tokenRow, error: tokenError } = await supabase
    .from('user_tokens')
    .select('access_token, expires_at')
    .eq('user_id', user.id)
    .eq('service', 'tidal')
    .single()

  if (tokenError || !tokenRow?.access_token) {
    return NextResponse.json({ error: 'Tidal account not connected' }, { status: 400 })
  }

  const expiresAt = tokenRow.expires_at ? new Date(tokenRow.expires_at) : null
  if (expiresAt && expiresAt < new Date()) {
    return NextResponse.json({ error: 'Tidal token expired. Reconnect in settings.' }, { status: 401 })
  }

  const description = formatDescription(
    playlist.comments,
    playlist.tags,
    playlist.energy,
    playlist.rating
  )

  const updateRes = await fetch(`${TIDAL_API}/playlists/${playlist.external_id}?countryCode=US`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${tokenRow.access_token}`,
      Accept: TIDAL_HDR,
      'Content-Type': TIDAL_HDR,
    },
    body: JSON.stringify({
      data: {
        type: 'playlists',
        id: playlist.external_id,
        attributes: { description },
      },
    }),
  })

  if (!updateRes.ok) {
    const text = await updateRes.text().catch(() => '')
    console.error('[sync-description] Tidal update failed:', updateRes.status, text)
    return NextResponse.json(
      { error: `Tidal API error ${updateRes.status}: ${text.slice(0, 200)}` },
      { status: 502 }
    )
  }

  return NextResponse.json({ success: true, description })
}
