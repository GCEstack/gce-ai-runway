import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

function cleanEnv(value: string | undefined): string | undefined {
  if (!value) return value
  return value.replace(/\uFEFF/g, '').trim()
}

function cleanJsonBody(obj: any): any {
  if (typeof obj === 'string') {
    return obj.replace(/\uFEFF/g, '').trim()
  }
  if (Array.isArray(obj)) {
    return obj.map(cleanJsonBody)
  }
  if (typeof obj === 'object' && obj !== null) {
    const cleaned: any = {}
    for (const key of Object.keys(obj)) {
      cleaned[key.replace(/\uFEFF/g, '').trim()] = cleanJsonBody(obj[key])
    }
    return cleaned
  }
  return obj
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json()
    const { email, password } = cleanJsonBody(rawBody)

    const supabaseUrl = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL)
    const supabaseAnonKey = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 })
    }

    let response = NextResponse.json({ success: true })

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    })

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    return response
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
