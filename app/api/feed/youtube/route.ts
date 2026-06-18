import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient, getAuthenticatedUser } from '@/lib/supabase/server'

const YOUTUBE_OEMBED = 'https://www.youtube.com/oembed'

interface YouTubeMeta {
  title: string
  author_name: string
}

const ALLOWED_YOUTUBE_HOSTS = new Set([
  'www.youtube.com',
  'youtube.com',
  'music.youtube.com',
  'youtu.be',
])

async function fetchMetadata(url: string): Promise<YouTubeMeta | null> {
  try {
    const params = new URLSearchParams({ url, format: 'json' })
    const res = await fetch(`${YOUTUBE_OEMBED}?${params.toString()}`, { next: { revalidate: 0 } })
    if (!res.ok) return null
    return (await res.json()) as YouTubeMeta
  } catch (e) {
    console.error('[feed/youtube] oEmbed error:', e)
    return null
  }
}

function isAllowedYouTubeUrl(url: URL): boolean {
  return url.protocol === 'https:' && ALLOWED_YOUTUBE_HOSTS.has(url.hostname)
}

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }

  if (!isAllowedYouTubeUrl(url)) return null

  // youtu.be/<id>
  if (url.hostname === 'youtu.be') {
    return `https://youtu.be/${url.pathname.slice(1).split('/')[0]}`
  }

  // youtube.com/watch?v=<id>
  const videoId = url.searchParams.get('v')
  if (videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`
  }

  return null
}

export async function POST(request: NextRequest) {
  const supabase = await createServiceClient()

  const { user } = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const rawUrls: string[] = Array.isArray(body.urls)
    ? body.urls
    : typeof body.urls === 'string'
      ? body.urls.split(/\n/).map((u: string) => u.trim()).filter(Boolean)
      : []

  if (rawUrls.length === 0) {
    return NextResponse.json({ error: 'No URLs provided' }, { status: 400 })
  }

  if (rawUrls.length > 20) {
    return NextResponse.json({ error: 'Max 20 URLs per request' }, { status: 400 })
  }

  const items = []
  for (const raw of rawUrls) {
    const url = normalizeUrl(raw)
    if (!url) continue

    const meta = await fetchMetadata(url)
    items.push({
      source: 'youtube',
      title: meta?.title || url,
      artist: meta?.author_name || null,
      url,
      genre: null,
      label: null,
      published_at: new Date().toISOString(),
      processed: false,
    })
  }

  if (items.length === 0) {
    return NextResponse.json({ error: 'No valid YouTube URLs found' }, { status: 400 })
  }

  const { data, error } = await supabase.from('feed_items').insert(items).select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ inserted: data?.length ?? 0, items: data })
}
