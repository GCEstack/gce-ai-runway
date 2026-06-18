'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Music,
  RefreshCw,
  Loader2,
  Disc3,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import type { Track, Service } from '@/lib/types'
import { GlassCard } from '@/components/GlassCard'
import { FilterPill } from '@/components/FilterPill'
import { cn } from '@/lib/utils'

const SOURCE_COLORS: Record<Service, string> = {
  spotify: 'bg-green-500/10 text-green-400 border-green-500/20',
  tidal: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  beatport: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
}

interface TrackGroup {
  prompt: string
  tracks: Track[]
  count: number
  latest: string
  expanded: boolean
}

function TrackRow({ track }: { track: Track }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] p-3 transition-colors hover:border-white/[0.08]">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
              SOURCE_COLORS[track.source]
            )}
          >
            {track.source}
          </span>
          <span className="text-[10px] text-text-tertiary">
            {track.discovered_by}
          </span>
          {track.isrc && (
            <span className="text-[10px] text-text-tertiary" title="ISRC">
              {track.isrc}
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-sm font-medium text-text-primary">{track.title}</p>
        <p className="truncate text-xs text-text-secondary">
          {track.artist} {track.album ? `• ${track.album}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 text-right">
        {track.discovered_at && (
          <span className="inline-flex items-center gap-1 text-[10px] text-text-tertiary">
            <Calendar size={10} />
            {new Date(track.discovered_at).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  )
}

export default function TracksPage() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [groups, setGroups] = useState<TrackGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [source, setSource] = useState<'all' | Service>('all')
  const [agent, setAgent] = useState<'all' | 'KIMI' | 'CLAUDE'>('all')
  const [rawCount, setRawCount] = useState(0)
  const [debug, setDebug] = useState<Record<string, unknown> | null>(null)

  async function load() {
    setLoading(true)
    const params = new URLSearchParams()
    if (source !== 'all') params.set('source', source)
    if (agent !== 'all') params.set('agent', agent)

    const res = await fetch(`/api/tracks?${params.toString()}`)
    const data = await res.json()

    if (res.ok) {
      setTracks((data.items ?? []) as Track[])
      setRawCount(data.count ?? 0)
      setDebug(data.debug ?? null)

      const grouped = (data.grouped ?? []) as TrackGroup[]
      setGroups(grouped.map((g) => ({ ...g, expanded: true })))
    } else {
      setTracks([])
      setGroups([])
      setRawCount(0)
      setDebug(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [source, agent])

  function handleRefresh() {
    setRefreshing(true)
    load().finally(() => setRefreshing(false))
  }

  function toggleGroup(prompt: string) {
    setGroups((prev) =>
      prev.map((g) => (g.prompt === prompt ? { ...g, expanded: !g.expanded } : g))
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-4xl text-text-primary">Discovered Tracks</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {rawCount} track{rawCount !== 1 ? 's' : ''} across {groups.length} prompt
            {groups.length !== 1 ? 's' : ''}
          </p>
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

      <div className="flex flex-wrap items-center gap-3 border-y border-white/[0.06] py-4">
        <div className="flex flex-wrap gap-2">
          <FilterPill label="All sources" active={source === 'all'} onClick={() => setSource('all')} />
          <FilterPill label="Spotify" active={source === 'spotify'} onClick={() => setSource('spotify')} />
          <FilterPill label="Tidal" active={source === 'tidal'} onClick={() => setSource('tidal')} />
        </div>
        <div className="hidden h-4 w-px bg-white/[0.08] sm:block" />
        <div className="flex flex-wrap gap-2">
          <FilterPill label="All agents" active={agent === 'all'} onClick={() => setAgent('all')} />
          <FilterPill label="KIMI" active={agent === 'KIMI'} onClick={() => setAgent('KIMI')} />
          <FilterPill label="CLAUDE" active={agent === 'CLAUDE'} onClick={() => setAgent('CLAUDE')} />
        </div>
      </div>

      {debug && (
        <GlassCard className="p-3">
          <p className="text-xs font-medium text-text-secondary">Debug</p>
          <pre className="mt-1 overflow-x-auto text-[10px] text-text-tertiary">
            {JSON.stringify(debug, null, 2)}
          </pre>
        </GlassCard>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-bg-surface" />
          ))}
        </div>
      ) : tracks.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <Music className="mx-auto mb-3 h-8 w-8 text-text-tertiary" />
          <p className="text-sm text-text-secondary">No tracks found</p>
          <p className="mt-1 text-xs text-text-tertiary">
            Run a discovery agent or check the debug panel above
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <GlassCard key={group.prompt} className="overflow-hidden p-0">
              <button
                onClick={() => toggleGroup(group.prompt)}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-white/[0.02]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Disc3 size={18} className="shrink-0 text-accent-gold" />
                  <div className="min-w-0">
                    <h3 className="truncate font-display text-lg text-text-primary">{group.prompt}</h3>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                      <span className="inline-flex items-center gap-1">
                        <Music size={10} />
                        {group.count} tracks
                      </span>
                      {group.latest && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={10} />
                          {new Date(group.latest).toLocaleDateString()}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                {group.expanded ? (
                  <ChevronUp size={18} className="shrink-0 text-text-tertiary" />
                ) : (
                  <ChevronDown size={18} className="shrink-0 text-text-tertiary" />
                )}
              </button>

              {group.expanded && (
                <div className="space-y-2 border-t border-white/[0.06] px-4 pb-4 pt-3">
                  {group.tracks.map((track) => (
                    <TrackRow key={track.id} track={track} />
                  ))}
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  )
}
