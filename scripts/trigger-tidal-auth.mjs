const SITE_URL = process.env.RUNWAY_SITE_URL || 'https://runway-lac-ten.vercel.app'
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const EMAIL = process.env.RUNWAY_TEST_EMAIL
const PASSWORD = process.env.RUNWAY_TEST_PASSWORD

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !EMAIL || !PASSWORD) {
  console.error('Missing required env vars. Need: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY), RUNWAY_TEST_EMAIL, RUNWAY_TEST_PASSWORD')
  process.exit(1)
}

// 1. Sign in directly with Supabase Auth to get full session
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

// 2. Trigger Tidal auth with full session cookie
const res = await fetch(`${SITE_URL}/api/tidal/auth`, {
  method: 'GET',
  headers: {
    'Cookie': `sb-access-token=${authData.access_token}; sb-udbgzgntfiytnuajnbvy-auth-token=${encodeURIComponent(sessionJson)}`,
  },
  redirect: 'manual',
})

const location = res.headers.get('location')
console.log('Tidal auth URL:', location)

// 3. Open browser
if (location && location.startsWith('https://login.tidal.com')) {
  const { exec } = await import('child_process')
  exec(`start "" "${location}"`)
  console.log('Opened browser for Tidal approval')
} else {
  const text = await res.text()
  console.error('Unexpected response. Status:', res.status, 'Body:', text)
}
