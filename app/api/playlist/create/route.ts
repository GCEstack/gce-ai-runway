import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { CreatePlaylistRequest } from '@/lib/types'

export async function POST(request: NextRequest) {
  const supabase = await createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null) as CreatePlaylistRequest | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const { name, agent, service, track_ids = [], prompt_name, external_id } = body as CreatePlaylistRequest & { external_id?: string }

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  if (!agent || !['KIMI', 'CLAUDE'].includes(agent))
    return NextResponse.json({ error: 'agent must be KIMI or CLAUDE' }, { status: 400 })
  if (!service || !['spotify', 'tidal'].includes(service))
    return NextResponse.json({ error: 'service must be spotify or tidal' }, { status: 400 })

  const { data: playlist, error } = await supabase
    .from('playlists')
    .insert({
      name,
      agent,
      service,
      external_id: external_id ?? null,
      track_count: track_ids.length,
      prompt_name: prompt_name ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ playlist })
}
