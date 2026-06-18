import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient, getAuthenticatedUser } from '@/lib/supabase/server'
import type { RateRequest } from '@/lib/types'

export async function POST(request: NextRequest) {
  const supabase = await createServiceClient()

  const { user } = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null) as RateRequest | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const { playlist_id, rating, feedback, tracks_kept = 0, tracks_removed = 0 } = body

  if (!playlist_id) return NextResponse.json({ error: 'playlist_id is required' }, { status: 400 })
  if (!rating || rating < 1 || rating > 5)
    return NextResponse.json({ error: 'rating must be 1–5' }, { status: 400 })

  const { data, error } = await supabase
    .from('ratings')
    .upsert(
      {
        playlist_id,
        rated_by: user.id,
        rating,
        feedback: feedback ?? null,
        tracks_kept,
        tracks_removed,
      },
      { onConflict: 'playlist_id,rated_by' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ rating: data })
}
