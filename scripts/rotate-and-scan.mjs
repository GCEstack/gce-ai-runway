#!/usr/bin/env node
/**
 * Runway key-rotation / leak-scan helper.
 *
 * This script does NOT rotate keys by itself (Supabase does not expose
 * service-role key rotation via a public API). Instead it:
 *   1. Scans the repo for likely hardcoded secrets.
 *   2. Validates that the required env vars are present.
 *   3. Prints the manual rotation runbook.
 *
 * Usage:
 *   node scripts/rotate-and-scan.mjs
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')

const PATTERNS = [
  // Supabase JWT-ish tokens (HS256 service-role or anon keys)
  /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6L+KA/,
  /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6L+KA/,
  // The literal old project ref
  /udbgzgntfiytnuajnbvy\.supabase\.co/,
  // Hardcoded Tidal client secret shape
  /uw4yKFokZ7tNwsvLfd1qOQkeoTyPqlLpMhdGarK7Qcs=/,
  // Hardcoded email / password from debug scripts
  /pwnetsuite@outlook\.com/,
  /Runway2026!/,
]

const IGNORED = [
  'node_modules',
  '.next',
  '.git',
  '.bak',
  'rotate-and-scan.mjs',
]

function walk(dir) {
  const entries = []
  for (const name of readdirSync(dir)) {
    if (IGNORED.some((i) => name.includes(i))) continue
    const full = join(dir, name)
    const s = statSync(full)
    if (s.isDirectory()) {
      entries.push(...walk(full))
    } else if (s.isFile() && (full.endsWith('.ts') || full.endsWith('.tsx') || full.endsWith('.js') || full.endsWith('.mjs') || full.endsWith('.py') || full.endsWith('.json'))) {
      entries.push(full)
    }
  }
  return entries
}

function scan() {
  const hits = []
  for (const file of walk(ROOT)) {
    const text = readFileSync(file, 'utf-8')
    for (const pattern of PATTERNS) {
      if (pattern.test(text)) {
        hits.push({ file: file.replace(ROOT + '/', ''), pattern: pattern.source })
      }
    }
  }
  return hits
}

function checkEnv() {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'TIDAL_CLIENT_ID',
    'TIDAL_CLIENT_SECRET',
  ]
  const optional = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'RUNWAY_TEST_EMAIL',
    'RUNWAY_TEST_PASSWORD',
    'SPOTIFY_CLIENT_ID',
    'SPOTIFY_CLIENT_SECRET',
  ]
  const missing = required.filter((k) => !process.env[k])
  return { missing, required, optional }
}

function printRunbook() {
  console.log(`
=== Runway key-rotation runbook ===
1. Supabase Dashboard → Project Settings → API.
2. Under "Project API keys" click "Rotate service role key" (or anon key).
3. Copy the new keys and update your environment:
     - Vercel dashboard / project settings / Environment Variables
     - Local .env.local
4. Update these variables:
     NEXT_PUBLIC_SUPABASE_URL
     NEXT_PUBLIC_SUPABASE_ANON_KEY
     SUPABASE_URL
     SUPABASE_ANON_KEY
     SUPABASE_SERVICE_ROLE_KEY
5. Redeploy the Vercel project so the new keys are active.
6. Rotate Tidal credentials at https://developer.tidal.com/dashboard
   and update TIDAL_CLIENT_ID / TIDAL_CLIENT_SECRET.
7. Rotate Spotify credentials at https://developer.spotify.com/dashboard
   and update SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET.
8. Revoke any old tokens that may have been leaked.
9. Re-run this script until "leaks found: 0" and "missing env vars: 0".
`)
}

const hits = scan()
const { missing, required, optional } = checkEnv()

console.log('Scanning for hardcoded secrets...')
if (hits.length === 0) {
  console.log('  ✅ No obvious hardcoded secrets found.')
} else {
  console.log(`  ❌ Found ${hits.length} potential leak(s):`)
  for (const hit of hits) {
    console.log(`     - ${hit.file} matched ${hit.pattern.slice(0, 60)}...`)
  }
}

console.log('\nChecking required env vars...')
if (missing.length === 0) {
  console.log('  ✅ All required env vars present.')
} else {
  console.log(`  ❌ Missing required env vars: ${missing.join(', ')}`)
}

console.log('\nOptional env vars (scripts may need these):')
for (const key of optional) {
  console.log(`  ${process.env[key] ? '✅' : '⚠️'} ${key}`)
}

console.log(`\nleaks found: ${hits.length}`)
console.log(`missing env vars: ${missing.length}`)

printRunbook()

process.exit(hits.length > 0 || missing.length > 0 ? 1 : 0)
