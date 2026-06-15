import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  generateCsrfToken,
  getCsrfTokenFromCookies,
  serializeCsrfCookie,
  CSRF_HEADER_NAME,
} from '@/lib/csrf'

export const runtime = 'experimental-edge'

function cleanEnv(value: string | undefined): string | undefined {
  if (!value) return value
  return value.replace(/\uFEFF/g, '').trim()
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const publicPaths = ['/login', '/_next', '/api/auth', '/gian-lucca']
  const isPublic = publicPaths.some((path) => pathname.startsWith(path))

  // Start with the incoming request headers so refreshed cookies are forwarded.
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // ─── CSRF double-submit cookie ─────────────────────────────────────────────
  let csrfToken = getCsrfTokenFromCookies(request.headers.get('cookie') ?? '')
  if (!csrfToken) {
    csrfToken = generateCsrfToken()
    response.headers.append('Set-Cookie', serializeCsrfCookie(csrfToken))
  }

  const isApiMutation =
    pathname.startsWith('/api/') && !SAFE_METHODS.has(request.method.toUpperCase())

  if (isApiMutation) {
    const headerToken = request.headers.get(CSRF_HEADER_NAME)
    if (!headerToken || headerToken !== csrfToken) {
      return NextResponse.json({ error: 'Invalid or missing CSRF token' }, { status: 403 })
    }
  }

  // ─── Auth ──────────────────────────────────────────────────────────────────
  const supabaseUrl = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const supabaseAnonKey = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
    return NextResponse.error()
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value)
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (isPublic) {
    return response
  }

  if (error || !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|mov|webm|m4a|mp3|wav|ogg)$).*)'],
}
