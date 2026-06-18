import { NextResponse } from 'next/server'
import { createServiceClient, getAuthenticatedUser } from '@/lib/supabase/server'
import { getBeatportGenres } from '@/lib/beatport'
import { getBeatportAccessToken } from '@/lib/beatport-auth'

export async function GET() {
  const { user } = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createServiceClient()

  const token = await getBeatportAccessToken(user.id, supabase)
  if (!token) {
    return NextResponse.json({ error: 'Beatport not connected or token expired' }, { status: 400 })
  }

  const genres = await getBeatportGenres(token)
  return NextResponse.json({ genres })
}
