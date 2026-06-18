import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient, getAuthenticatedUser } from '@/lib/supabase/server'

function normalizeTags(tags: unknown): string | null {
  if (tags === undefined || tags === null) return null
  if (typeof tags === 'string') {
    return tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .join(', ') || null
  }
  if (Array.isArray(tags)) {
    return tags
      .map((t) => (typeof t === 'string' ? t.trim() : String(t).trim()))
      .filter(Boolean)
      .join(', ') || null
  }
  return null
}

function normalizeKeepRemove(keep: unknown): 'keep' | 'remove' | null {
  if (keep === undefined || keep === null) return null
  if (keep === true || keep === 'keep') return 'keep'
  if (keep === false || keep === 'remove') return 'remove'
  return null
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  const supabase = await createServiceClient()

  const { user } = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: playlist, error: playlistError } = await supabase
    .from('playlists')
    .select('id, user_id')
    .eq('id', id)
    .single()

  if (playlistError || !playlist) {
    return NextResponse.json({ error: 'Playlist not found' }, { status: 404 })
  }
  if (playlist.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('tracks')
    .select('*')
    .eq('playlist_id', id)
    .order('discovered_at', { ascending: false })

  if (error) {
    console.error('[tracks GET] error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  const supabase = await createServiceClient()

  const { user } = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: playlist, error: playlistError } = await supabase
    .from('playlists')
    .select('id, user_id')
    .eq('id', id)
    .single()

  if (playlistError || !playlist) {
    return NextResponse.json({ error: 'Playlist not found' }, { status: 404 })
  }
  if (playlist.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { trackId, tags, comments, keep_remove } = body
  if (!trackId || typeof trackId !== 'string') {
    return NextResponse.json({ error: 'trackId is required' }, { status: 400 })
  }

  // Ensure the track belongs to this playlist.
  const { data: track, error: trackError } = await supabase
    .from('tracks')
    .select('id, playlist_id')
    .eq('id', trackId)
    .eq('playlist_id', id)
    .single()

  if (trackError || !track) {
    return NextResponse.json({ error: 'Track not found' }, { status: 404 })
  }

  const update: Record<string, unknown> = {}
  if (tags !== undefined) update.tags = normalizeTags(tags)
  if (comments !== undefined) update.comments = typeof comments === 'string' ? comments.trim() || null : null
  if (keep_remove !== undefined) update.keep_remove = normalizeKeepRemove(keep_remove)

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { error } = await supabase.from('tracks').update(update).eq('id', trackId)

  if (error) {
    console.error('[tracks PATCH] error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
