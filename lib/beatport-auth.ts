// Beatport token management: refresh expired access tokens using the stored refresh_token.

import type { SupabaseClient } from '@supabase/supabase-js'

const BEATPORT_TOKEN_URL = 'https://api.beatport.com/v4/auth/o/token/'

function getClientId(): string | null {
  const id = process.env.BEATPORT_CLIENT_ID
  return id && id.trim() ? id.trim() : null
}

function getClientSecret(): string | null {
  const secret = process.env.BEATPORT_CLIENT_SECRET
  return secret && secret.trim() ? secret.trim() : null
}

function isExpired(expiresAt: string | null, bufferSeconds = 60): boolean {
  if (!expiresAt) return true
  const d = new Date(expiresAt)
  if (isNaN(d.getTime())) return true
  return d.getTime() - bufferSeconds * 1000 <= Date.now()
}

async function refreshToken(
  refreshToken: string
): Promise<{ access_token: string; refresh_token?: string; expires_in: number; scope?: string } | null> {
  const clientId = getClientId()
  if (!clientId) {
    console.error('[BeatportAuth] BEATPORT_CLIENT_ID not configured')
    return null
  }

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    refresh_token: refreshToken,
  })
  const clientSecret = getClientSecret()
  if (clientSecret) {
    params.append('client_secret', clientSecret)
  }

  const res = await fetch(BEATPORT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error('[BeatportAuth] Refresh failed:', res.status, text.slice(0, 200))
    return null
  }

  return (await res.json()) as {
    access_token: string
    refresh_token?: string
    expires_in: number
    scope?: string
  }
}

/**
 * Returns a valid Beatport access token for the given user, refreshing it if necessary.
 * Updates the user_tokens row with the new token when refreshed.
 */
export async function getBeatportAccessToken(
  userId: string,
  supabase: SupabaseClient
): Promise<string | null> {
  const { data: row, error } = await supabase
    .from('user_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .eq('service', 'beatport')
    .single()

  if (error || !row) {
    console.error('[BeatportAuth] No beatport token found:', error?.message)
    return null
  }

  if (!isExpired(row.expires_at)) {
    return row.access_token
  }

  if (!row.refresh_token) {
    console.error('[BeatportAuth] Token expired and no refresh_token available')
    return null
  }

  const refreshed = await refreshToken(row.refresh_token)
  if (!refreshed) {
    return null
  }

  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()

  const { error: upsertError } = await supabase.from('user_tokens').upsert(
    {
      user_id: userId,
      service: 'beatport',
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token ?? row.refresh_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,service' }
  )

  if (upsertError) {
    console.error('[BeatportAuth] Failed to save refreshed token:', upsertError.message)
    return null
  }

  return refreshed.access_token
}
