'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ExternalLink, Zap, Rss } from 'lucide-react'
import type { FeedItem, FeedSource } from '@/lib/types'
import clsx from 'clsx'

const SOURCE_LABELS: Record<FeedSource, string> = {
  beatport: 'Beatport',
  '1001tracklists': '1001Tracklists',
  youtube: 'YouTube',
}

const SOURCE_COLORS: Record<FeedSource, string> = {
  beatport: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  '1001tracklists': 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  youtube: 'bg-red-500/15 text-red-400 border-red-500/20',
}

function FeedCard({ item, onDiscover }: { item: FeedItem; onDiscover: (item: FeedItem) => void }) {
  const [discovering, setDiscovering] = useState(false)

  async function handleDiscover() {
    setDiscovering(true)
    await onDiscover(item)
    setDiscovering(false)
  }

  return (
    <div className={clsx('card p-4 transition-colors', item.processed && 'opacity-60')}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={clsx('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border', SOURCE_COLORS[item.source])}>
              {SOURCE_LABELS[item.source]}
            </span>
            {item.genre && (
              <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">{item.genre}</span>
            )}
            {item.label && (
              <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">{item.label}</span>
            )}
            {item.processed && (
              <span className="text-xs text-green-500">✓ processed</span>
            )}
          </div>
          <p className="text-sm font-medium text-white leading-snug">{item.title}</p>
          {item.artist && (
            <p className="text-xs text-zinc-400 mt-0.5">{item.artist}</p>
          )}
          {item.published_at && (
            <p className="text-xs text-zinc-600 mt-1">
              {new Date(item.published_at).toLocaleDateString()}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-zinc-500 hover:text-white transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <button
            onClick={handleDiscover}
            disabled={discovering || item.processed}
            className="p-1.5 text-zinc-500 hover:text-violet-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Discover similar"
          >
            <Zap className={clsx('w-3.5 h-3.5', discovering && 'animate-pulse text-violet-400')} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FeedPage() {
  const [items, setItems] = useState<FeedItem[]>([])
  const [source, setSource] = useState<FeedSource | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [showProcessed, setShowProcessed] = useState(false)

  async function load() {
    setLoading(true)
    const supabase = createClient()
    let query = supabase
      .from('feed_items')
      .select('*')
      .order('published_at', { ascending: false })
      .limit(100)
    if (source !== 'all') query = query.eq('source', source)
    if (!showProcessed) query = query.eq('processed', false)
    const { data } = await query
    setItems((data ?? []) as FeedItem[])
    setLoading(false)
  }

  useEffect(() => { load() }, [source, showProcessed])

  async function handleDiscover(item: FeedItem) {
    // Mark as processed + trigger discovery
    const supabase = createClient()
    await supabase.from('feed_items').update({ processed: true }).eq('id', item.id)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, processed: true } : i))
    // Fire discovery in background
    fetch('/api/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feed_item_id: item.id, agent: 'CLAUDE' }),
    }).catch(console.error)
  }

  const sources: { value: FeedSource | 'all'; label: string }[] = [
    { value: 'all', label: 'All Sources' },
    { value: 'beatport', label: 'Beatport' },
    { value: '1001tracklists', label: '1001Tracklists' },
    { value: 'youtube', label: 'YouTube' },
  ]

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Feed</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Beatport, 1001Tracklists, YouTube</p>
        </div>
        <button onClick={load} className="btn-secondary">
          <Rss className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {sources.map(s => (
          <button
            key={s.value}
            onClick={() => setSource(s.value)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
              source === s.value
                ? 'bg-violet-600/20 text-violet-300 border-violet-500/40'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700'
            )}
          >
            {s.label}
          </button>
        ))}
        <label className="flex items-center gap-1.5 ml-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showProcessed}
            onChange={e => setShowProcessed(e.target.checked)}
            className="rounded border-zinc-700 bg-zinc-900 text-violet-500 focus:ring-violet-500"
          />
          <span className="text-xs text-zinc-400">Show processed</span>
        </label>
        <span className="ml-auto text-xs text-zinc-500">{items.length} items</span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card p-12 text-center">
          <Rss className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">No feed items</p>
          <p className="text-xs text-zinc-600 mt-1">Use POST /api/feed to ingest items</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <FeedCard key={item.id} item={item} onDiscover={handleDiscover} />
          ))}
        </div>
      )}
    </div>
  )
}
