const SITE_URL = process.env.RUNWAY_SITE_URL || 'https://runway-lac-ten.vercel.app'
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const EMAIL = process.env.RUNWAY_TEST_EMAIL
const PASSWORD = process.env.RUNWAY_TEST_PASSWORD

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY || !EMAIL || !PASSWORD) {
  console.error('Missing required env vars. Need: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY), SUPABASE_SERVICE_ROLE_KEY, RUNWAY_TEST_EMAIL, RUNWAY_TEST_PASSWORD')
  process.exit(1)
}

// 1. Sign in directly with Supabase Auth to get the full session cookie
const authRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
})
const authData = await authRes.json()
if (!authRes.ok) {
  console.error('Auth failed:', authData)
  process.exit(1)
}
const session = {
  access_token: authData.access_token,
  refresh_token: authData.refresh_token,
  expires_in: authData.expires_in,
  expires_at: authData.expires_at,
  token_type: authData.token_type,
  user: authData.user,
}
const sessionJson = JSON.stringify(session)
console.log('Signed in as Dekan')

// 2. Find latest Tidal playlist
const playlistsRes = await fetch(
  `${SUPABASE_URL}/rest/v1/playlists?select=*&service=eq.tidal&order=created_at.desc&limit=1`,
  { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
)
const playlists = await playlistsRes.json()
if (!playlists || playlists.length === 0) {
  console.error('No Tidal playlists found')
  process.exit(1)
}
const playlist = playlists[0]
console.log('Latest Tidal playlist:', playlist.name, playlist.id)

// 3. Call recommend-similar with both cookies
const res = await fetch(`${SITE_URL}/api/recommend-similar`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Cookie': `sb-access-token=${authData.access_token}; sb-udbgzgntfiytnuajnbvy-auth-token=${encodeURIComponent(sessionJson)}`,
  },
  body: JSON.stringify({ playlist_id: playlist.id }),
})

const text = await res.text()
console.log('API status:', res.status)
console.log('API response:', text)
