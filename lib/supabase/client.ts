'use client'

import { createBrowserClient } from '@supabase/ssr'

function cleanEnv(value: string | undefined): string | undefined {
  if (!value) return value
  return value.replace(/\uFEFF/g, '').trim()
}

export function createClient() {
  return createBrowserClient(
    cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL)!,
    cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!
  )
}
