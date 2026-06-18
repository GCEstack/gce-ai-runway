import { NextResponse } from 'next/server'
import { createServiceClient, getAuthenticatedUser } from '@/lib/supabase/server'
import { getBeatportUser } from '@/lib/beatport'

export async function GET() {
  const { user } = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()
  const { data: tokenRow } = await supabase
    .from('user_tokens')
    .select('access_token')
    .eq('user_id', user.id)
    .eq('service', 'beatport')
    .single()

  if (!tokenRow?.access_token) {
    return NextResponse.json({ error: 'No Beatport token found' }, { status: 400 })
  }

  const profile = await getBeatportUser(tokenRow.access_token)
  if (!profile) {
    return NextResponse.json({ error: 'Failed to fetch Beatport profile' }, { status: 500 })
  }

  return NextResponse.json({ profile })
}
