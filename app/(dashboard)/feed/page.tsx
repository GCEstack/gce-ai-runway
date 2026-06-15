'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  ExternalLink,
  Zap,
  Rss,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  Plus,
  Youtube,
} from 'lucide-react'
import type { FeedItem, FeedSource } from '@/lib/types'
import { GlassCard } from '@/components/GlassCard'
import { FilterPill } from '@/components/FilterPill'
import { cn } from '@/lib/utils'

const SOURCE_LABELS: Record<FeedSource, string> = {
  beatport: 'Beatport',
  '1001tracklists': '1001Tracklists',
  youtube: 'YouTube',
}

const SOURCE_COLORS: Record<FeedSource, string> = {
  beatport: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  '1001tracklists': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  youtube: 'bg-red-500/10 text-red-400 border-red-500/20',
}

interface PendingRun {
  runId: string
  feedItemId: string
  status: 'running' | 'completed' | 'failed'
}

function FeedCard({
  item,
  onDiscover,
  pendingRun,
}: {
  item: FeedItem
  onDiscover: (item: FeedItem) => void
  pendingRun?: PendingRun
}) {
  const [discovering, setDiscovering] = useState(false)

  async function handleDiscover() {
    setDiscovering(true)
    await onDiscover(item)
    setDiscovering(false)
  }

  return (
    <GlassCard className={cn('p-4 transition-opacity', item.processed && 'opacity-60')}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                SOURCE_COLORS[item.source]
              )}
            >
              {SOURCE_LABELS[item.source]}
            </span>
            {item.genre && (
              <span className="rounded bg-white/[0.04] px-2 py-0.5 text-xs text-text-tertiary">
                {item.genre}
              </span>
            )}
            {item.label && (
              <span className="rounded bg-white/[0.04] px-2 py-0.5 text-xs text-text-tertiary">
                {item.label}
              </span>
            )}
            {item.processed && <span className="text-xs text-status-success">✓ processed</span>}
          </div>
          <p className="text-sm font-medium leading-snug text-text-primary">{item.title}</p>
          {item.artist && <p className="mt-0.5 text-xs text-text-secondary">{item.artist}</p>}
          {item.published_at && (
            <p className="mt-1 text-xs text-text-tertiary">
              {new Date(item.published_at).toLocaleDateString()}
            </p>
          )}
        </div>
        <div className="flex flex-shrink-0 gap-2">
          {item.url && item.url.startsWith('https://') && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary"
            >
              <ExternalLink size={12} />
              Open
            </a>
          )}
          {item.url && !item.url.startsWith('https://') && (
            <span className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-text-tertiary">
              {item.url}
            </span>
          )}
          <button
            onClick={handleDiscover}
            disabled={discovering || item.processed || !!pendingRun}
            className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:text-accent-gold disabled:cursor-not-allowed disabled:opacity-40"
            title="Discover similar"
          >
            {pendingRun?.status === 'running' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-accent-gold" />
            ) : pendingRun?.status === 'completed' ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-status-success" />
            ) : pendingRun?.status === 'failed' ? (
              <XCircle className="h-3.5 w-3.5 text-status-error" />
            ) : (
              <Zap className={cn('h-3.5 w-3.5', discovering && 'animate-pulse text-accent-gold')} />
            )}
            {pendingRun?.status === 'running'
              ? 'Running…'
              : pendingRun?.status === 'completed'
                ? 'Done'
                : pendingRun?.status === 'failed'
                  ? 'Failed'
                  : 'Discover'}
          </button>
        </div>
      </div>
    </GlassCard>
  )
}

export default function FeedPage() {
  const [items, setItems] = useState<FeedItem[]>([])
  const [source, setSource] = useState<FeedSource | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [showProcessed, setShowProcessed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [pendingRuns, setPendingRuns] = useState<Record<string, PendingRun>>({})
  const [youtubeUrls, setYoutubeUrls] = useState('')
  const [addingYoutube, setAddingYoutube] = useState(false)
  const [scrapeLoading, setScrapeLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const supabase = createClient()

  function showToast(message: string) {
    setToast(message)
    setTimeout(() => setToast(null), 3000)
  }

  async function load() {
    setLoading(true)
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

  useEffect(() => {
    load()
  }, [source, showProcessed])

  async function handleDiscover(item: FeedItem) {
    const res = await fetch('/api/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feed_item_id: item.id, agent: 'CLAUDE' }),
    })
    const data = await res.json()

    if (res.ok && data.run_id) {
      setPendingRuns((prev) => ({
        ...prev,
        [item.id]: { runId: data.run_id, feedItemId: item.id, status: 'running' },
      }))
    }

    await supabase.from('feed_items').update({ processed: true }).eq('id', item.id)
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, processed: true } : i)))
  }

  // Poll pending run statuses
  useEffect(() => {
    const runIds = Object.values(pendingRuns)
      .filter((r) => r.status === 'running')
      .map((r) => r.runId)

    if (runIds.length === 0) return

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('agent_runs')
        .select('id, status')
        .in('id', runIds)

      if (!data) return

      setPendingRuns((prev) => {
        const next = { ...prev }
        for (const run of data) {
          const entry = Object.values(next).find((r) => r.runId === run.id)
          if (entry && run.status !== 'running') {
            next[entry.feedItemId] = { ...entry, status: run.status as 'completed' | 'failed' }
          }
        }
        return next
      })
    }, 3000)

    return () => clearInterval(interval)
  }, [pendingRuns, supabase])

  async function handleAddYoutube(e: React.FormEvent) {
    e.preventDefault()
    if (!youtubeUrls.trim()) return
    setAddingYoutube(true)
    const res = await fetch('/api/feed/youtube', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: youtubeUrls }),
    })
    const data = await res.json()
    setAddingYoutube(false)
    if (res.ok) {
      setYoutubeUrls('')
      showToast(`Added ${data.inserted} YouTube item${data.inserted === 1 ? '' : 's'}`)
      load()
    } else {
      showToast(data.error || 'Failed to add YouTube links')
    }
  }

  async function handleScrape(target: 'beatport' | '1001tracklists' | 'all') {
    setScrapeLoading(true)
    const res = await fetch('/api/feed/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: target }),
    })
    const data = await res.json()
    setScrapeLoading(false)
    if (res.ok) {
      showToast(`Scraped ${data.saved ?? 0} ${target} items`)
      load()
    } else {
      showToast(data.error || 'Scrape failed')
    }
  }

  function handleRefresh() {
    setRefreshing(true)
    load().finally(() => setRefreshing(false))
  }

  const sources: { value: FeedSource | 'all'; label: string }[] = [
    { value: 'all', label: 'All Sources' },
    { value: 'beatport', label: 'Beatport' },
    { value: '1001tracklists', label: '1001Tracklists' },
    { value: 'youtube', label: 'YouTube' },
  ]

  const filteredItems = items.filter((item) => (source === 'all' ? true : item.source === source))

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg border border-white/[0.08] bg-bg-surface-solid px-4 py-2 text-sm text-text-primary shadow-xl">
          {toast}
        </div>
      )}

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-4xl text-text-primary">Feed</h1>
          <p className="mt-1 text-sm text-text-secondary">Beatport, 1001Tracklists, YouTube</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading || refreshing}
          className={cn(
            'flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary',
            refreshing && 'refresh-spinning'
          )}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </header>

      {/* Source tabs + actions */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {sources.map((s) => (
              <FilterPill
                key={s.value}
                label={s.label}
                active={source === s.value}
                onClick={() => setSource(s.value)}
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowProcessed((v) => !v)}
              className={cn(
                'flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                showProcessed
                  ? 'border-accent-gold/40 bg-accent-gold/10 text-accent-gold'
                  : 'border-white/[0.08] text-text-secondary hover:text-text-primary'
              )}
            >
              Show processed
            </button>
            <span className="text-xs text-text-tertiary">{filteredItems.length} items</span>
          </div>
        </div>

        {/* Source-specific action panels */}
        {source === 'beatport' && (
          <GlassCard className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-medium text-text-primary">Beatport melodic techno</h3>
                <p className="text-xs text-text-secondary">Top 100 + new releases (past 7 days), max 50 items</p>
              </div>
              <button
                onClick={() => handleScrape('beatport')}
                disabled={scrapeLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/15"
              >
                {scrapeLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Scrape Beatport
              </button>
            </div>
          </GlassCard>
        )}

        {source === '1001tracklists' && (
          <GlassCard className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-medium text-text-primary">1001Tracklists techno</h3>
                <p className="text-xs text-text-secondary">Trending tracklists tagged techno/melodic techno, min 5 tracks, max 30</p>
              </div>
              <button
                onClick={() => handleScrape('1001tracklists')}
                disabled={scrapeLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-orange-500/10 px-4 py-2 text-sm font-medium text-orange-400 transition-colors hover:bg-orange-500/15"
              >
                {scrapeLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Scrape 1001Tracklists
              </button>
            </div>
          </GlassCard>
        )}

        {source === 'youtube' && (
          <GlassCard className="p-4">
            <form onSubmit={handleAddYoutube} className="space-y-3">
              <div>
                <h3 className="text-sm font-medium text-text-primary">Add YouTube links</h3>
                <p className="text-xs text-text-secondary">Paste up to 20 links, one per line. Titles auto-fetched.</p>
              </div>
              <textarea
                value={youtubeUrls}
                onChange={(e) => setYoutubeUrls(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=...&#10;https://youtu.be/..."
                rows={4}
                className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-red-500/40 focus:outline-none"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={addingYoutube || !youtubeUrls.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/15 disabled:opacity-50"
                >
                  {addingYoutube ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Add YouTube items
                </button>
              </div>
            </form>
          </GlassCard>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-bg-surface" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <Rss className="mx-auto mb-3 h-8 w-8 text-text-tertiary" />
          <p className="text-sm text-text-secondary">No feed items</p>
          <p className="mt-1 text-xs text-text-tertiary">
            {source === 'youtube'
              ? 'Paste YouTube links above'
              : source === 'all'
                ? 'Scrape a source or add YouTube links'
                : `Scrape ${SOURCE_LABELS[source as FeedSource]} or switch sources`}
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <FeedCard
              key={item.id}
              item={item}
              onDiscover={handleDiscover}
              pendingRun={pendingRuns[item.id]}
            />
          ))}
        </div>
      )}

      <button
        onClick={handleRefresh}
        className={cn(
          'fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent-gold text-black shadow-lg shadow-accent-gold/30',
          'transition-transform hover:scale-105 active:scale-95 sm:hidden',
          refreshing && 'refresh-spinning'
        )}
      >
        <RefreshCw size={22} />
      </button>
    </div>
  )
}
