import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import {
  TIDAL_CLIENT_ID,
  TIDAL_CLIENT_SECRET,
  getRedirectUri,
  getBaseUrl,
} from '@/lib/tidal/auth-config'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const siteUrl = getBaseUrl()
  const redirectUri = getRedirectUri()

  if (error) {
    console.error('[tidal/callback] Tidal returned error', { error })
    return NextResponse.redirect(`${siteUrl}/settings?error=${encodeURIComponent(error)}`)
  }

  if (!code) {
    return NextResponse.redirect(`${siteUrl}/settings?error=missing_code`)
  }

  const storedState = request.cookies.get('tidal_oauth_state')?.value
  const codeVerifier = request.cookies.get('tidal_pkce_verifier')?.value

  if (state !== storedState) {
    return NextResponse.redirect(`${siteUrl}/settings?error=state_mismatch`)
  }
  if (!codeVerifier) {
    return NextResponse.redirect(`${siteUrl}/settings?error=missing_verifier`)
  }

  if (!TIDAL_CLIENT_ID || !TIDAL_CLIENT_SECRET) {
    console.error('[tidal/callback] Tidal credentials missing')
    return NextResponse.redirect(
      `${siteUrl}/settings?error=${encodeURIComponent('Tidal credentials are not configured')}`
    )
  }

  try {
    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: TIDAL_CLIENT_ID,
      client_secret: TIDAL_CLIENT_SECRET,
      code_verifier: codeVerifier,
    })

    const tokenRes = await fetch('https://auth.tidal.com/v1/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody,
    })

    const tokenText = await tokenRes.text()
    let tokens: Record<string, any>
    try {
      tokens = JSON.parse(tokenText)
    } catch {
      tokens = { raw: tokenText }
    }

    if (!tokenRes.ok) {
      console.error('[tidal/callback] token exchange failed', { status: tokenRes.status })
      const description = tokens.error_description || tokens.error || tokenText
      throw new Error(`Token exchange failed (${tokenRes.status}): ${description}`)
    }

    // Decode userId from JWT payload
    let tidalUid = ''
    try {
      const payload = JSON.parse(Buffer.from(tokens.access_token.split('.')[1], 'base64').toString())
      tidalUid = String(payload.uid ?? '')
    } catch (jwtErr) {
      console.error('[tidal/callback] could not decode access token JWT', jwtErr)
    }

    // Get current Runway user
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.redirect(`${siteUrl}/login`)
    }

    // Upsert token into user_tokens (service role to bypass RLS)
    const admin = await createServiceClient()
    const { error: upsertError } = await admin.from('user_tokens').upsert(
      {
        user_id: user.id,
        service: 'tidal',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        service_user_id: tidalUid,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,service' }
    )

    if (upsertError) {
      console.error('[tidal/callback] failed to store token', upsertError)
      throw new Error(`Failed to store token: ${upsertError.message}`)
    }

    const response = NextResponse.redirect(`${siteUrl}/settings?connected=tidal`)
    response.cookies.delete('tidal_pkce_verifier')
    response.cookies.delete('tidal_oauth_state')
    return response
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[tidal/callback] unhandled error', msg)
    return NextResponse.redirect(`${siteUrl}/settings?error=${encodeURIComponent(msg)}`)
  }
}
