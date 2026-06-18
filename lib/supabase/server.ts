import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

function cleanEnv(value: string | undefined): string | undefined {
  if (!value) return value
  return value.replace(/\uFEFF/g, '').trim()
}

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL)!,
    cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component — cookie writes are handled by middleware
          }
        },
      },
    }
  )
}

export async function createServiceClient() {
  // Service role client bypasses RLS. Use the standard @supabase/supabase-js
  // client so user auth cookies do not override the service role key.
  return createSupabaseClient(
    cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL)!,
    cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY)!
  )
}

/**
 * Get the currently authenticated user from the request cookies.
 * Use this in API routes instead of calling auth.getUser() on the service
 * client, which has no access to the user's session.
 */
export async function getAuthenticatedUser() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  return { user: data.user, error }
}
