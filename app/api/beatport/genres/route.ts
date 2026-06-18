import { NextResponse } from 'next/server'
import { createServiceClient, getAuthenticatedUser } from '@/lib/supabase/server'
import { getBeatportGenres } from '@/lib/beatport'

export async function GET() {
  const { user } = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createServiceClient()

  const { data: tokenRow } = await supabase
    .from('user_tokens')
    .select('access_token')
    .eq('user_id', user.id)
    .eq('service', 'beatport')
    .single()

  if (!tokenRow?.access_token) {
    return NextResponse.json({ error: 'Beatport not connected' }, { status: 400 })
  }

  const genres = await getBeatportGenres(tokenRow.access_token)
  return NextResponse.json({ genres })
}
