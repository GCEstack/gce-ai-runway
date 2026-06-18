import { NextResponse } from 'next/server'
import { createServiceClient, getAuthenticatedUser } from '@/lib/supabase/server'

function decodeJwtSubject(token: string): string | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const json = Buffer.from(payload, 'base64url').toString('utf8')
    return (JSON.parse(json).sub as string) ?? null
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  const { user } = await getAuthenticatedUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Accept either { token: {...} } or the token fields directly at the top level
  const token = (body.token as Record<string, unknown> | undefined) ?? body

  if (!token || !token.access_token) {
    return NextResponse.json({ error: 'token.access_token is required' }, { status: 400 })
  }

  try {
    const accessToken = token.access_token as string
    const refreshToken = token.refresh_token as string | null
    const expiresIn = token.expires_in as number | null
    const scope = token.scope as string | null
    const serviceUserId =
      (token.service_user_id as string | undefined) ??
      decodeJwtSubject(accessToken) ??
      null

    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null

    const supabase = await createServiceClient()
    const { error } = await supabase.from('user_tokens').upsert(
      {
        user_id: user.id,
        service: 'beatport',
        access_token: accessToken,
        refresh_token: refreshToken ?? null,
        expires_at: expiresAt,
        service_user_id: serviceUserId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,service' }
    )

    if (error) {
      console.error('[Beatport] user_tokens upsert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      expires_at: expiresAt,
      scope,
      username: serviceUserId ?? user.email ?? user.id,
    })
  } catch (err) {
    console.error('[Beatport] Token error:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
