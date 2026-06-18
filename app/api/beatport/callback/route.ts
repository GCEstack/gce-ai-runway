import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`/settings?error=beatport_${error}`)
  }

  if (!code) {
    return NextResponse.redirect('/settings?error=beatport_auth_failed')
  }

  const clientId = process.env.BEATPORT_CLIENT_ID
  const clientSecret = process.env.BEATPORT_CLIENT_SECRET
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL

  if (!clientId || !clientSecret || !siteUrl) {
    return NextResponse.redirect('/settings?error=beatport_config_missing')
  }

  const redirectUri = `${siteUrl}/api/beatport/callback`

  try {
    const tokenRes = await fetch('https://api.beatport.com/v4/auth/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenRes.ok) {
      const body = await tokenRes.text().catch(() => '')
      console.error('[Beatport] Token exchange failed:', tokenRes.status, body)
      return NextResponse.redirect('/settings?error=beatport_token_exchange_failed')
    }

    const tokenData = await tokenRes.json()

    const supabase = await createServiceClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect('/settings?error=not_authenticated')
    }

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

    return NextResponse.redirect('/settings?success=beatport_connected')
  } catch (err) {
    console.error('[Beatport] Callback error:', err)
    return NextResponse.redirect('/settings?error=beatport_unexpected')
  }
}
