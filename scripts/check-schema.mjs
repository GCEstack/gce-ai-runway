import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const envText = fs.readFileSync('.env.local', 'utf-8')
const env = {}
for (const line of envText.split('\n')) {
  const idx = line.indexOf('=')
  if (idx <= 0 || line.startsWith('#')) continue
  let key = line.slice(0, idx).trim()
  let value = line.slice(idx + 1).trim()
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1)
  }
  env[key] = value
}

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Missing env vars', { url: !!url, key: !!key })
  process.exit(1)
}

const sb = createClient(url, key)

async function check() {
  const { error: plErr } = await sb
    .from('playlists')
    .select('id,tags,comments,energy,rating')
    .limit(1)
  if (plErr) {
    console.error('playlists error:', plErr.message)
  } else {
    console.log('playlists OK')
  }

  const { error: trErr } = await sb
    .from('tracks')
    .select('id,tags,comments,keep_remove,playlist_id')
    .limit(1)
  if (trErr) {
    console.error('tracks error:', trErr.message)
  } else {
    console.log('tracks OK')
  }
}

check().catch(console.error)
