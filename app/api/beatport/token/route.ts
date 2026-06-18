import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const BEATPORT_TOKEN_URL = 'https://api.beatport.com/v4/auth/o/token/'

export async function POST(request: Request) {
  const supabase = await createServiceClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { username, password } = body as { username?: string; password?: string }

  if (!username || !password) {
    return NextResponse.json({ error: 'username and password are required' }, { status: 400 })
  }

  const clientId = process.env.BEATPORT_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'BEATPORT_CLIENT_ID not configured' }, { status: 500 })
  }

  try {
    const tokenRes = await fetch(BEATPORT_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: clientId,
        username,
        password,
      }),
    })

    if (!tokenRes.ok) {
      const text = await tokenRes.text().catch(() => '')
      console.error('[Beatport] Password grant failed:', tokenRes.status, text)
      return NextResponse.json({ error: 'Beatport authentication failed' }, { status: 400 })
    }

    const tokenData = await tokenRes.json()

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null

    await supabase.from('user_tokens').upsert(
      {
        user_id: user.id,
        service: 'beatport',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token ?? null,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,service' }
    )

    return NextResponse.json({
      success: true,
      expires_in: tokenData.expires_in,
      scope: tokenData.scope,
    })
  } catch (err) {
    console.error('[Beatport] Token error:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
