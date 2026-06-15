/**
 * Shared Tidal OAuth configuration for the Next.js app.
 * This file is imported only by server-side API routes.
 */

function clean(s: string | undefined): string {
  return (s ?? '').replace(/^\uFEFF/, '').trim()
}

export const TIDAL_CLIENT_ID = clean(process.env.TIDAL_CLIENT_ID)
export const TIDAL_CLIENT_SECRET = clean(process.env.TIDAL_CLIENT_SECRET)

export function getBaseUrl(): string {
  const url = clean(process.env.NEXT_PUBLIC_SITE_URL)
  if (!url) {
    throw new Error('Missing required environment variable: NEXT_PUBLIC_SITE_URL')
  }
  // Strip trailing slashes so the redirect URI never ends up with a double slash.
  return url.replace(/\/+$/, '')
}

export function getRedirectUri(): string {
  return `${getBaseUrl()}/api/tidal/callback`
}

export const TIDAL_COOKIE_OPTIONS = {
  httpOnly: true,
  maxAge: 600,
  sameSite: 'lax' as const,
  path: '/',
  secure: process.env.NODE_ENV === 'production',
}

export const TIDAL_SCOPES = 'user.read playlists.read playlists.write collection.read search.read'
