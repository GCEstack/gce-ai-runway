// Client-side fetch helper that injects the CSRF token for mutating API calls.
// The middleware requires a double-submit CSRF cookie/header for POST/PATCH/DELETE
// requests to /api/* routes.

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from './csrf'

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie
    .split(';')
    .find((c) => c.trim().startsWith(`${name}=`))
  if (!match) return undefined
  return match.split('=').slice(1).join('=').trim()
}

export function getCsrfToken(): string | undefined {
  return getCookie(CSRF_COOKIE_NAME)
}

/**
 * Drop-in replacement for fetch that adds the CSRF header for mutating methods.
 * Safe to use for GETs as well (no header added).
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase()
  const needsCsrf = !['GET', 'HEAD', 'OPTIONS'].includes(method)

  const baseHeaders: Record<string, string> = {}
  if (needsCsrf) {
    const token = getCsrfToken()
    if (token) baseHeaders[CSRF_HEADER_NAME] = token
  }

  const headers: Record<string, string> = {
    ...baseHeaders,
    ...(init?.headers as Record<string, string> ?? {}),
  }

  return fetch(input, { ...init, headers })
}
