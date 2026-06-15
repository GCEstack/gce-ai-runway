import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { FeedSource } from '@/lib/types'

// GET /api/feed?source=beatport&limit=50&unprocessed=true
export async function GET(request: NextRequest) {
  const supabase = await createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const source = searchParams.get('source') as FeedSource | null
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)
  const unprocessed = searchParams.get('unprocessed') === 'true'

  let query = supabase
    .from('feed_items')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(limit)

  if (source && ['beatport', '1001tracklists', 'youtube'].includes(source)) {
    query = query.eq('source', source)
  }
  if (unprocessed) query = query.eq('processed', false)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ items: data })
}

// POST /api/feed — ingest feed items
export async function POST(request: NextRequest) {
  const supabase = await createServiceClient()

  // Feed ingestion is server-to-server. Require either an authenticated user
  // or a shared secret in the Authorization header.
  const authHeader = request.headers.get('authorization') ?? ''
  const sharedSecret = process.env.FEED_INGEST_SECRET
  const { data: { user } } = await supabase.auth.getUser()

  const isAuthorized = !!user || (sharedSecret && authHeader === `Bearer ${sharedSecret}`)
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const items = Array.isArray(body) ? body : [body]

  // Reject non-HTTPS URLs to prevent javascript: and data: schemes in feed links.
  for (const item of items) {
    if (item.url && !String(item.url).startsWith('https://')) {
      return NextResponse.json({ error: 'Feed item URLs must use HTTPS' }, { status: 400 })
    }
  }

  const { data, error } = await supabase.from('feed_items').insert(items).select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ inserted: data?.length ?? 0, items: data })
}
