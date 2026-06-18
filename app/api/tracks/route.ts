import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const promptName = searchParams.get('prompt_name')
  const source = searchParams.get('source')
  const agent = searchParams.get('agent')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '500'), 1000)

  let query = supabase
    .from('tracks')
    .select('*')
    .order('discovered_at', { ascending: false })
    .limit(limit)

  if (promptName) query = query.eq('prompt_name', promptName)
  if (source) query = query.eq('source', source)
  if (agent) query = query.eq('discovered_by', agent)

  const { data, error } = await query

  if (error) {
    console.error('[tracks API] error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Group by prompt_name
  const grouped = new Map<string, typeof data>()
  for (const track of data ?? []) {
    const key = track.prompt_name ?? 'Unnamed prompt'
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(track)
  }

  const groupedArray = Array.from(grouped.entries()).map(([prompt, tracks]) => ({
    prompt,
    tracks,
    count: tracks.length,
    latest: tracks[0]?.discovered_at,
  }))

  return NextResponse.json({
    items: data ?? [],
    count: data?.length ?? 0,
    grouped: groupedArray,
  })
}
