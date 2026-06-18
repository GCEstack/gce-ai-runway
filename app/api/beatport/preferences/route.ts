import { NextResponse } from 'next/server'
import { createServiceClient, getAuthenticatedUser } from '@/lib/supabase/server'

export async function GET() {
  const { user } = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createServiceClient()

  const { data } = await supabase
    .from('user_tokens')
    .select('preferences')
    .eq('user_id', user.id)
    .eq('service', 'beatport')
    .single()

  const preferences = (data?.preferences as Record<string, unknown> | null) ?? {}
  return NextResponse.json({ preferences })
}

export async function POST(request: Request) {
  const { user } = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const preferences = body.preferences as Record<string, unknown> | null
  if (!preferences) return NextResponse.json({ error: 'preferences required' }, { status: 400 })

  const supabase = await createServiceClient()

  const { error } = await supabase
    .from('user_tokens')
    .update({ preferences })
    .eq('user_id', user.id)
    .eq('service', 'beatport')

  if (error) {
    console.error('[Beatport] Preferences update error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
