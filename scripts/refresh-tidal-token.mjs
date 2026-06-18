import fs from 'fs'
import path from 'path'
import os from 'os'

const CLIENT_ID = process.env.TIDAL_CLIENT_ID
const CLIENT_SECRET = process.env.TIDAL_CLIENT_SECRET
const tokenPath = path.join(os.homedir(), '.tidal-mcp-tokens.json')

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing required env vars: TIDAL_CLIENT_ID and TIDAL_CLIENT_SECRET')
  process.exit(1)
}

const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'))
console.log('Refreshing Tidal token for user', tokens.userId)

const res = await fetch('https://auth.tidal.com/v1/oauth2/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokens.refreshToken,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  }),
})

const data = await res.json()
if (!res.ok) {
  console.error('Refresh failed:', data)
  process.exit(1)
}

const newTokens = {
  accessToken: data.access_token,
  refreshToken: data.refresh_token || tokens.refreshToken,
  expiresAt: Date.now() + data.expires_in * 1000,
  userId: tokens.userId,
}

fs.writeFileSync(tokenPath, JSON.stringify(newTokens, null, 2))
console.log('Token refreshed, expires at', new Date(newTokens.expiresAt).toISOString())
