import { NextResponse } from 'next/server'
import { createServiceClient, getAuthenticatedUser } from '@/lib/supabase/server'
import { getBeatportUser } from '@/lib/beatport'
import { getBeatportAccessToken } from '@/lib/beatport-auth'

export async function GET() {
  const { user } = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()
  const token = await getBeatportAccessToken(user.id, supabase)
  if (!token) {
    return NextResponse.json({ error: 'No Beatport token found or token expired' }, { status: 400 })
  }

  const profile = await getBeatportUser(token)
  if (!profile) {
    return NextResponse.json({ error: 'Failed to fetch Beatport profile' }, { status: 500 })
  }

  return NextResponse.json({ profile })
}
