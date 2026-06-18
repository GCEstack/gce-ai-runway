import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient, getAuthenticatedUser } from '@/lib/supabase/server'
import type { CreatePlaylistRequest } from '@/lib/types'

export async function POST(request: NextRequest) {
  const supabase = await createServiceClient()

  const { user } = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null) as CreatePlaylistRequest | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const { name, agent, service, track_ids = [], prompt_name, external_id } = body as CreatePlaylistRequest & { external_id?: string }

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  if (!agent || !['KIMI', 'CLAUDE'].includes(agent))
    return NextResponse.json({ error: 'agent must be KIMI or CLAUDE' }, { status: 400 })
  if (!service || !['spotify', 'tidal', 'beatport'].includes(service))
    return NextResponse.json({ error: 'service must be spotify, tidal, or beatport' }, { status: 400 })

  const { data: playlist, error } = await supabase
    .from('playlists')
    .insert({
      name,
      agent,
      service,
      external_id: external_id ?? null,
      track_count: track_ids.length,
      prompt_name: prompt_name ?? null,
      user_id: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Link provided tracks to the new playlist
  if (playlist && track_ids.length > 0) {
    await supabase
      .from('tracks')
      .update({ playlist_id: playlist.id })
      .in('id', track_ids)
  }

  const { data: tracks } = await supabase
    .from('tracks')
    .select('*')
    .eq('playlist_id', playlist.id)
    .order('discovered_at', { ascending: false })

  return NextResponse.json({ playlist, tracks: tracks ?? [] })
}
