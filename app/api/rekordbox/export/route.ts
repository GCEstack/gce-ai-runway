import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { Track } from '@/lib/types'

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildRekordboxXml(playlist: { name: string }, tracks: Track[]): string {
  const entries = tracks.length

  const trackNodes = tracks
    .map(
      (t, i) => `    <TRACK
      TrackID="${i + 1}"
      Name="${escapeXml(t.title)}"
      Artist="${escapeXml(t.artist)}"
      Album="${escapeXml(t.album ?? '')}"
      Genre=""
      Kind="MP3 File"
      Size="0"
      TotalTime="0"
      DiscNumber="0"
      TrackNumber="${i + 1}"
      Year="0"
      AverageBpm="0.00"
      DateAdded="${t.discovered_at.slice(0, 10)}"
      BitRate="320"
      SampleRate="44100"
      Comments="${escapeXml(t.prompt_name ?? '')}"
      PlayCount="0"
      Rating="0"
      Location=""
      Label=""
    />`
    )
    .join('\n')

  const playlistTracks = tracks.map((_, i) => `        <TRACK Key="${i + 1}"/>`).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<DJ_PLAYLISTS Version="1.0.0">
  <PRODUCT Name="rekordbox" Version="6.0.0" Company="Pioneer DJ"/>
  <COLLECTION Entries="${entries}">
${trackNodes}
  </COLLECTION>
  <PLAYLISTS>
    <NODE Type="0" Name="ROOT" Count="1">
      <NODE Name="${escapeXml(playlist.name)}" Type="1" KeyType="0" Entries="${entries}">
${playlistTracks}
      </NODE>
    </NODE>
  </PLAYLISTS>
</DJ_PLAYLISTS>`
}

// POST /api/rekordbox/export
// body: { playlist_id: string } | { track_ids: string[] }
export async function POST(request: NextRequest) {
  const supabase = await createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  let tracks: Track[] = []
  let playlistName = 'Runway Export'

  if (body.playlist_id) {
    const { data: pl, error: plError } = await supabase
      .from('playlists')
      .select('name, user_id')
      .eq('id', body.playlist_id)
      .single()
    if (plError || !pl) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 })
    }
    if (pl.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    playlistName = pl.name ?? playlistName
    const { data: tks } = await supabase
      .from('tracks')
      .select('*')
      .eq('playlist_id', body.playlist_id)
      .limit(500)
    tracks = (tks ?? []) as Track[]
  } else if (Array.isArray(body.track_ids) && body.track_ids.length > 0) {
    const { data } = await supabase.from('tracks').select('*').in('id', body.track_ids)
    tracks = (data ?? []) as Track[]
  } else {
    // Export everything discovered today
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const { data } = await supabase.from('tracks').select('*').gte('discovered_at', today.toISOString())
    tracks = (data ?? []) as Track[]
    playlistName = `Runway ${today.toISOString().slice(0, 10)}`
  }

  const xml = buildRekordboxXml({ name: playlistName }, tracks)

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Content-Disposition': `attachment; filename="runway-${Date.now()}.xml"`,
    },
  })
}
