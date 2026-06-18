'use client'

import { useEffect } from 'react'
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@/lib/csrf'

function getCsrfTokenFromDocument(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie.split(';').find((c) => c.trim().startsWith(`${CSRF_COOKIE_NAME}=`))
  if (!match) return undefined
  return match.split('=').slice(1).join('=').trim()
}

function isSameOriginApiRequest(input: RequestInfo | URL): boolean {
  if (typeof window === 'undefined') return false
  let url: string
  if (input instanceof URL) {
    url = input.toString()
  } else if (typeof input === 'string') {
    url = input
  } else {
    url = input.url
  }
  return url.startsWith('/api/') || url.startsWith(`${window.location.origin}/api/`)
}

export function CsrfProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const originalFetch = window.fetch

    window.fetch = async function csrfFetch(
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      if (isSameOriginApiRequest(input)) {
        const method = (init?.method ?? 'GET').toUpperCase()
        const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(method)
        if (isMutation) {
          const token = getCsrfTokenFromDocument()
          if (token) {
            init = {
              ...init,
              headers: {
                ...(init?.headers ?? {}),
                [CSRF_HEADER_NAME]: token,
              },
            }
          }
        }
      }
      return originalFetch(input, init)
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [])

  return <>{children}</>
}
