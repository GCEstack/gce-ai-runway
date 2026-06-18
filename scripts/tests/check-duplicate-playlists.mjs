#!/usr/bin/env node
/**
 * Diagnostic script: detect duplicate playlists in Supabase.
 * Duplicates are defined as rows with the same (user_id, service, external_id).
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function main() {
  // Find duplicates
  const { data, error } = await supabase.rpc('exec_sql', {
    query: `
      SELECT user_id, service, external_id, COUNT(*) AS count
      FROM playlists
      WHERE external_id IS NOT NULL
      GROUP BY user_id, service, external_id
      HAVING COUNT(*) > 1
      ORDER BY count DESC;
    `,
  })

  if (error) {
    // exec_sql may not exist; fallback to fetching all and grouping in JS
    console.warn('[check-duplicates] exec_sql not available, falling back to JS grouping:', error.message)
    const { data: all, error: fetchError } = await supabase
      .from('playlists')
      .select('id, user_id, service, external_id, name, created_at')
      .not('external_id', 'is', null)
      .eq('status', 'active')

    if (fetchError) {
      console.error('[check-duplicates] failed to fetch playlists:', fetchError.message)
      process.exit(1)
    }

    const groups = new Map()
    for (const pl of all ?? []) {
      const key = `${pl.user_id}|${pl.service}|${pl.external_id}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(pl)
    }

    const duplicates = Array.from(groups.values()).filter((g) => g.length > 1)
    console.log(`[check-duplicates] ${duplicates.length} duplicate groups found`)
    for (const group of duplicates.slice(0, 20)) {
      console.log(`\nGroup: ${group[0].service} ${group[0].external_id}`)
      for (const pl of group) {
        console.log(`  - ${pl.id} | ${pl.name} | ${pl.created_at}`)
      }
    }
    process.exit(duplicates.length > 0 ? 1 : 0)
  }

  console.log(`[check-duplicates] ${data?.length ?? 0} duplicate groups found`)
  for (const row of data ?? []) {
    console.log(`  ${row.service} ${row.external_id}: ${row.count} copies (user ${row.user_id})`)
  }
  process.exit(data?.length > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
