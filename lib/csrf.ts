export function generateCsrfToken(): string {
  // Use crypto.randomUUID when available (Node 14.17+, modern browsers).
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  // Fallback for older environments.
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

const CSRF_COOKIE_NAME = 'csrf-token'
const CSRF_HEADER_NAME = 'x-csrf-token'

export { CSRF_COOKIE_NAME, CSRF_HEADER_NAME }

export function getCsrfTokenFromCookies(cookieHeader: string): string | undefined {
  const match = cookieHeader.split(';').find((c) => c.trim().startsWith(`${CSRF_COOKIE_NAME}=`))
  if (!match) return undefined
  return match.split('=').slice(1).join('=').trim()
}

export function serializeCsrfCookie(token: string): string {
  const parts = [
    `${CSRF_COOKIE_NAME}=${token}`,
    'Path=/',
    'SameSite=Strict',
    'Secure',
  ]
  return parts.join('; ')
}
