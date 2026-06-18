import { NextResponse } from 'next/server'

export async function GET() {
  const clientId = process.env.BEATPORT_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'BEATPORT_CLIENT_ID not configured' }, { status: 500 })
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/beatport/callback`

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'catalog charts',
  })

  return NextResponse.redirect(
    `https://api.beatport.com/v4/auth/o/authorize?${params.toString()}`
  )
}
