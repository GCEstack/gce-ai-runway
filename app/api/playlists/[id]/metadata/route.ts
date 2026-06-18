import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const TIDAL_API = 'https://openapi.tidal.com/v2'
const TIDAL_HDR = 'application/vnd.api+json'

function buildTidalDescription(meta: {
  tags?: string | null
  comments?: string | null
  rating?: number | null
  rater?: string | null
}): string {
  const parts: string[] = []
  if (meta.tags) parts.push(`Tags: ${meta.tags}`)
  if (meta.comments) parts.push(`Comments: ${meta.comments}`)
  if (meta.rating) {
    const stars = '⭐'.repeat(meta.rating)
    parts.push(`Rated: ${stars}${meta.rater ? ` by ${meta.rater}` : ''}`)
  }
  return parts.join(' | ')
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const { tags, comments, energy, rating } = body as {
    tags?: string
    comments?: string
    energy?: 'low' | 'medium' | 'high' | 'peak'
    rating?: number
  }

  const playlistId = params.id

  const { data: playlist } = await supabase
    .from('playlists')
    .select('*')
    .eq('id', playlistId)
    .single()
  if (!playlist) return NextResponse.json({ error: 'Playlist not found' }, { status: 404 })
  if (playlist.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: latestRating } = await supabase
    .from('ratings')
    .select('rating, rated_by')
    .eq('playlist_id', playlistId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const effectiveRating = rating ?? latestRating?.rating ?? null
  const rater = latestRating?.rated_by ?? null

  const { error: updateError } = await supabase
    .from('playlists')
    .update({
      tags: tags ?? null,
      comments: comments ?? null,
      energy: energy ?? null,
      rating: effectiveRating,
      updated_at: new Date().toISOString(),
    })
    .eq('id', playlistId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  if (playlist.service === 'tidal' && playlist.external_id) {
    const { data: tokenRow } = await supabase
      .from('user_tokens')
      .select('access_token')
      .eq('user_id', user.id)
      .eq('service', 'tidal')
      .single()

    if (tokenRow?.access_token) {
      const newDescription = buildTidalDescription({
        tags,
        comments,
        rating: effectiveRating,
        rater,
      })

      try {
        await fetch(`${TIDAL_API}/playlists/${playlist.external_id}`, {
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
              attributes: { description: newDescription },
            },
          }),
        })
      } catch (e) {
        console.error('[PlaylistMetadata] Tidal sync error:', e)
      }
    }
  }

  return NextResponse.json({ success: true })
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: playlist } = await supabase
    .from('playlists')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!playlist) return NextResponse.json({ error: 'Playlist not found' }, { status: 404 })
  if (playlist.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json(playlist)
}
