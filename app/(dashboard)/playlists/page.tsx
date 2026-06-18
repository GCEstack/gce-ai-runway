'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  ListMusic,
  MoreHorizontal,
  RefreshCw,
  Settings,
  ExternalLink,
  Download,
  Loader2,
  Sparkles,
  Pencil,
  Trash2,
  RotateCw,
  X,
  Check,
} from 'lucide-react'
import Link from 'next/link'
import type { Playlist, Track, Agent, Service } from '@/lib/types'
import { GlassCard } from '@/components/GlassCard'
import { AgentBadge } from '@/components/AgentBadge'
import { ServiceBadge } from '@/components/ServiceBadge'
import { FilterPill } from '@/components/FilterPill'
import { cn } from '@/lib/utils'

type ServiceFilter = 'all' | Service
type AgentFilter = 'all' | Agent
type PeriodFilter = 'all' | '7d' | '30d' | '90d'
type StatusFilter = 'active' | 'all'

type PlaylistWithTracks = Playlist & { tracks?: Track[] }

interface RecommendState {
  playlistId: string
  service: Service
}

interface CompletedRecommend {
  playlistId: string
  service: Service
  url: string
  trackCount: number
}

interface EditState {
  open: boolean
  playlist: Playlist | null
  name: string
  description: string
  saving: boolean
}

function PlaylistCard({
  pl,
  idx,
  recommending,
  completed,
  onRecommend,
  onEdit,
  onDelete,
  onSync,
  deleting,
  syncing,
}: {
  pl: PlaylistWithTracks
  idx: number
  recommending?: RecommendState
  completed?: CompletedRecommend
  onRecommend: (playlistId: string, service: Service) => void
  onEdit: (playlist: Playlist) => void
  onDelete: (playlist: Playlist) => void
  onSync: (playlist: Playlist) => void
  deleting?: boolean
  syncing?: boolean
}) {
  const url = pl.external_id
    ? pl.service === 'spotify'
      ? `https://open.spotify.com/playlist/${pl.external_id}`
      : pl.service === 'beatport'
        ? `https://www.beatport.com/chart/${pl.external_id}`
        : `https://tidal.com/playlist/${pl.external_id}`
    : null

  const isRecTidal = recommending?.playlistId === pl.id && recommending?.service === 'tidal'
  const isRecSpotify = recommending?.playlistId === pl.id && recommending?.service === 'spotify'
  const isRecBeatport = recommending?.playlistId === pl.id && recommending?.service === 'beatport'
  const doneTidal = completed?.playlistId === pl.id && completed?.service === 'tidal'
  const doneSpotify = completed?.playlistId === pl.id && completed?.service === 'spotify'
  const doneBeatport = completed?.playlistId === pl.id && completed?.service === 'beatport'
  const isDeleted = pl.status === 'deleted'

  return (
    <GlassCard
      className={cn(
        'card-enter flex h-full flex-col p-5',
        isDeleted && 'opacity-50 grayscale'
      )}
      style={{ animationDelay: `${idx * 40}ms` }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <AgentBadge agent={pl.agent} />
          <ServiceBadge service={pl.service} />
          {isDeleted && (
            <span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-400">
              Deleted
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-white/[0.04] hover:text-text-primary"
              title="Open in service"
            >
              <ExternalLink size={14} />
            </a>
          )}
          <button
            onClick={() => onEdit(pl)}
            className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-white/[0.04] hover:text-text-primary"
            title="Edit"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => onSync(pl)}
            disabled={syncing}
            className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-white/[0.04] hover:text-text-primary disabled:opacity-50"
            title="Check if still exists"
          >
            {syncing ? <Loader2 size={14} className="animate-spin" /> : <RotateCw size={14} />}
          </button>
          <button
            onClick={() => onDelete(pl)}
            disabled={deleting}
            className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-50"
            title="Delete"
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        </div>
      </div>

      <Link href={`/playlists/${pl.id}`}>
        <h3 className="mb-4 line-clamp-2 font-display text-xl text-text-primary transition-colors hover:text-accent-gold">
          {pl.name}
        </h3>
      </Link>

      {pl.prompt_name && (
        <p className="mb-2 text-xs text-text-tertiary">Prompt: {pl.prompt_name}</p>
      )}

      <div className="flex items-center justify-between text-xs text-text-secondary">
        <span>
          <span className="font-medium text-text-primary">{pl.track_count}</span> tracks
        </span>
        <span>
          {new Date(pl.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </span>
      </div>

      {pl.tracks && pl.tracks.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-white/[0.04] pt-3">
          {pl.tracks.slice(0, 3).map((track) => (
            <div key={track.id} className="flex items-center gap-2 text-xs">
              <span
                className={cn(
                  'shrink-0 rounded px-1 py-0.5 text-[10px] font-medium uppercase',
                  track.source === 'spotify'
                    ? 'bg-green-500/10 text-green-400'
                    : track.source === 'beatport'
                      ? 'bg-orange-500/10 text-orange-400'
                      : 'bg-cyan-500/10 text-cyan-400'
                )}
              >
                {track.source}
              </span>
              <span className="truncate font-medium text-text-primary">{track.title}</span>
              <span className="truncate text-text-tertiary">— {track.artist}</span>
            </div>
          ))}
          {pl.track_count > 3 && (
            <p className="text-[10px] text-text-tertiary">+{pl.track_count - 3} more</p>
          )}
        </div>
      )}

      <div className="mt-auto grid grid-cols-3 gap-2 pt-4">
        <button
          onClick={() => onRecommend(pl.id, 'tidal')}
          disabled={!!recommending || isDeleted}
          className={cn(
            'flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-medium transition-colors',
            doneTidal
              ? 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/15'
              : 'border border-white/[0.08] bg-white/[0.04] text-text-secondary hover:border-cyan-500/30 hover:text-cyan-400',
            isRecTidal && 'cursor-wait opacity-70',
            isDeleted && 'cursor-not-allowed opacity-40'
          )}
        >
          {isRecTidal ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {doneTidal ? (
            <a href={doneTidal ? completed?.url : undefined} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
              Tidal <ExternalLink size={10} />
            </a>
          ) : (
            'Similar on Tidal'
          )}
        </button>
        <button
          onClick={() => onRecommend(pl.id, 'beatport')}
          disabled={!!recommending || isDeleted}
          className={cn(
            'flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-medium transition-colors',
            doneBeatport
              ? 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/15'
              : 'border border-white/[0.08] bg-white/[0.04] text-text-secondary hover:border-orange-500/30 hover:text-orange-400',
            isRecBeatport && 'cursor-wait opacity-70',
            isDeleted && 'cursor-not-allowed opacity-40'
          )}
        >
          {isRecBeatport ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {doneBeatport ? (
            <a href={doneBeatport ? completed?.url : undefined} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
              Beatport <ExternalLink size={10} />
            </a>
          ) : (
            'Similar on Beatport'
          )}
        </button>
        <button
          onClick={() => onRecommend(pl.id, 'spotify')}
          disabled={!!recommending || isDeleted}
          className={cn(
            'flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-medium transition-colors',
            doneSpotify
              ? 'bg-green-500/10 text-green-400 hover:bg-green-500/15'
              : 'border border-white/[0.08] bg-white/[0.04] text-text-secondary hover:border-green-500/30 hover:text-green-400',
            isRecSpotify && 'cursor-wait opacity-70',
            isDeleted && 'cursor-not-allowed opacity-40'
          )}
        >
          {isRecSpotify ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {doneSpotify ? (
            <a href={doneSpotify ? completed?.url : undefined} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
              Spotify <ExternalLink size={10} />
            </a>
          ) : (
            'Similar on Spotify'
          )}
        </button>
      </div>
    </GlassCard>
  )
}

function EditModal({
  state,
  onClose,
  onSave,
}: {
  state: EditState
  onClose: () => void
  onSave: (id: string, name: string, description: string) => Promise<void>
}) {
  const [name, setName] = useState(state.name)
  const [description, setDescription] = useState(state.description)

  useEffect(() => {
    setName(state.name)
    setDescription(state.description)
  }, [state.name, state.description])

  if (!state.open || !state.playlist) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <GlassCard className="w-full max-w-md p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-text-primary">Edit playlist</h2>
          <button onClick={onClose} className="rounded-md p-1 text-text-tertiary hover:bg-white/[0.04] hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={state.saving}
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-text-primary focus:border-accent-gold/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={state.saving}
              rows={3}
              className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-text-primary focus:border-accent-gold/50 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              disabled={state.saving}
              className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(state.playlist!.id, name, description)}
              disabled={state.saving}
              className="flex items-center gap-2 rounded-lg bg-accent-gold/10 px-4 py-2 text-sm font-medium text-accent-gold transition-colors hover:bg-accent-gold/15"
            >
              {state.saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Save
            </button>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<PlaylistWithTracks[]>([])
  const [service, setService] = useState<ServiceFilter>('all')
  const [agent, setAgent] = useState<AgentFilter>('all')
  const [period, setPeriod] = useState<PeriodFilter>('30d')
  const [status, setStatus] = useState<StatusFilter>('active')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [recommending, setRecommending] = useState<RecommendState | null>(null)
  const [completedRecommend, setCompletedRecommend] = useState<CompletedRecommend | null>(null)
  const [recommendError, setRecommendError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [edit, setEdit] = useState<EditState>({
    open: false,
    playlist: null,
    name: '',
    description: '',
    saving: false,
  })

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase
      .from('playlists')
      .select('*, tracks(title, artist, id, source, discovered_at)')
      .order('created_at', { ascending: false })
      .limit(3, { foreignTable: 'tracks' })

    if (service !== 'all') query = query.eq('service', service)
    if (agent !== 'all') query = query.eq('agent', agent)
    if (status === 'active') query = query.eq('status', 'active')
    if (period !== 'all') {
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
      const since = new Date(Date.now() - days * 86400000).toISOString()
      query = query.gte('created_at', since)
    }

    const { data } = await query.limit(200)
    setPlaylists((data ?? []) as PlaylistWithTracks[])
    setLoading(false)
  }, [service, agent, period, status])

  useEffect(() => {
    load()
  }, [load])

  async function syncService(svc: 'spotify' | 'tidal' | 'beatport') {
    setSyncing(svc)
    setSyncMsg(null)
    const res = await fetch('/api/playlists/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: svc }),
    })
    const data = await res.json()
    if (res.ok) {
      setSyncMsg(`Synced ${data.synced} playlists from ${svc}`)
      load()
    } else {
      setSyncMsg(data.error ?? 'Sync failed')
    }
    setSyncing(null)
  }

  async function syncPlaylist(pl: Playlist) {
    setSyncingId(pl.id)
    setSyncMsg(null)
    const res = await fetch('/api/playlist/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: pl.id }),
    })
    const data = await res.json()
    if (res.ok) {
      const result = data.results?.[0]
      if (result && !result.exists) {
        setSyncMsg(`Marked "${pl.name}" as deleted in ${pl.service}`)
      } else {
        setSyncMsg(`"${pl.name}" still exists in ${pl.service}`)
      }
      load()
    } else {
      setSyncMsg(data.error ?? 'Sync failed')
    }
    setSyncingId(null)
  }

  function handleRefresh() {
    setRefreshing(true)
    load().finally(() => setRefreshing(false))
  }

  async function handleRecommend(playlistId: string, service: Service) {
    setRecommending({ playlistId, service })
    setRecommendError(null)
    try {
      const res = await fetch('/api/recommend-similar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlist_id: playlistId, agent: 'CLAUDE', service }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Recommendation failed')
      setCompletedRecommend({
        playlistId,
        service,
        url: data.playlist.url,
        trackCount: data.playlist.track_count,
      })
      load()
    } catch (err: any) {
      setRecommendError(err.message)
    } finally {
      setRecommending(null)
    }
  }

  async function handleDelete(pl: Playlist) {
    if (!confirm(`Delete "${pl.name}"?\n\nThis marks it as deleted in Runway and attempts to remove it from ${pl.service}.`)) {
      return
    }
    setDeletingId(pl.id)
    const res = await fetch('/api/playlist/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: pl.id }),
    })
    const data = await res.json()
    setDeletingId(null)
    if (res.ok) {
      load()
    } else {
      setSyncMsg(data.error ?? 'Delete failed')
    }
  }

  function openEdit(pl: Playlist) {
    setEdit({
      open: true,
      playlist: pl,
      name: pl.name,
      description: pl.comments ?? '',
      saving: false,
    })
  }

  async function handleEditSave(id: string, name: string, description: string) {
    setEdit((prev) => ({ ...prev, name, description, saving: true }))
    const res = await fetch('/api/playlist/edit', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name, description }),
    })
    const data = await res.json()
    setEdit((prev) => ({ ...prev, saving: false }))
    if (res.ok) {
      setEdit((prev) => ({ ...prev, open: false }))
      load()
    } else {
      setSyncMsg(data.error ?? 'Edit failed')
    }
  }

  const periodLabels: Record<PeriodFilter, string> = {
    '7d': 'Last 7 days',
    '30d': 'Last 30 days',
    '90d': 'Last 90 days',
    all: 'All time',
  }

  return (
    <div className="space-y-6">
      <EditModal state={edit} onClose={() => setEdit((prev) => ({ ...prev, open: false }))} onSave={handleEditSave} />

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-4xl text-text-primary">Playlists</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {periodLabels[period]} · {playlists.length} playlist{playlists.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          <Link
            href="/settings"
            className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-white/[0.15] hover:text-text-primary"
          >
            <Settings size={16} />
            Settings
          </Link>
          <button
            onClick={() => syncService('tidal')}
            disabled={!!syncing}
            className="flex items-center gap-2 rounded-lg bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-400 transition-colors hover:bg-cyan-500/15"
          >
            {syncing === 'tidal' ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            Import Tidal
          </button>
          <button
            onClick={() => syncService('beatport')}
            disabled={!!syncing}
            className="flex items-center gap-2 rounded-lg bg-orange-500/10 px-4 py-2 text-sm font-medium text-orange-400 transition-colors hover:bg-orange-500/15"
          >
            {syncing === 'beatport' ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            Import Beatport
          </button>
          <button
            onClick={() => syncService('spotify')}
            disabled={!!syncing}
            className="flex items-center gap-2 rounded-lg bg-green-500/10 px-4 py-2 text-sm font-medium text-green-400 transition-colors hover:bg-green-500/15"
          >
            {syncing === 'spotify' ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            Import Spotify
          </button>
          <button
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className={cn(
              'rounded-lg border border-white/[0.08] bg-white/[0.04] p-2 text-text-secondary transition-colors hover:text-text-primary',
              refreshing && 'refresh-spinning'
            )}
          >
            <RefreshCw size={18} />
          </button>
        </div>

        <div className="relative sm:hidden">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-2 text-text-secondary"
          >
            <MoreHorizontal size={20} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-xl border border-white/[0.08] bg-bg-surface-solid p-2 shadow-xl">
              <Link
                href="/settings"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-white/[0.04]"
              >
                <Settings size={16} /> Settings
              </Link>
              <button
                onClick={() => syncService('tidal')}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-cyan-400 hover:bg-white/[0.04]"
              >
                <Download size={16} /> Import Tidal
              </button>
              <button
                onClick={() => syncService('beatport')}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-orange-400 hover:bg-white/[0.04]"
              >
                <Download size={16} /> Import Beatport
              </button>
              <button
                onClick={() => syncService('spotify')}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-green-400 hover:bg-white/[0.04]"
              >
                <Download size={16} /> Import Spotify
              </button>
              <button
                onClick={handleRefresh}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-white/[0.04]"
              >
                <RefreshCw size={16} className={cn(refreshing && 'refresh-spinning')} /> Refresh
              </button>
            </div>
          )}
        </div>
      </header>

      {syncMsg && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-text-secondary">
          {syncMsg}
          <button onClick={() => setSyncMsg(null)} className="ml-4 text-text-tertiary hover:text-text-primary">
            ×
          </button>
        </div>
      )}

      {recommendError && (
        <div className="rounded-lg bg-status-error/10 px-3 py-2 text-sm text-status-error">
          {recommendError}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-y border-white/[0.06] py-4">
        <div className="flex flex-wrap gap-2">
          <FilterPill label="7d" active={period === '7d'} onClick={() => setPeriod('7d')} />
          <FilterPill label="30d" active={period === '30d'} onClick={() => setPeriod('30d')} />
          <FilterPill label="90d" active={period === '90d'} onClick={() => setPeriod('90d')} />
          <FilterPill label="All time" active={period === 'all'} onClick={() => setPeriod('all')} />
        </div>
        <div className="hidden h-4 w-px bg-white/[0.08] sm:block" />
        <div className="flex flex-wrap gap-2">
          <FilterPill label="All services" active={service === 'all'} onClick={() => setService('all')} />
          <FilterPill label="Spotify" active={service === 'spotify'} onClick={() => setService('spotify')} />
          <FilterPill label="Tidal" active={service === 'tidal'} onClick={() => setService('tidal')} />
          <FilterPill label="Beatport" active={service === 'beatport'} onClick={() => setService('beatport')} />
        </div>
        <div className="hidden h-4 w-px bg-white/[0.08] sm:block" />
        <div className="flex flex-wrap gap-2">
          <FilterPill label="All agents" active={agent === 'all'} onClick={() => setAgent('all')} />
          <FilterPill label="KIMI" active={agent === 'KIMI'} onClick={() => setAgent('KIMI')} />
          <FilterPill label="CLAUDE" active={agent === 'CLAUDE'} onClick={() => setAgent('CLAUDE')} />
        </div>
        <div className="hidden h-4 w-px bg-white/[0.08] sm:block" />
        <div className="flex flex-wrap gap-2">
          <FilterPill label="Active" active={status === 'active'} onClick={() => setStatus('active')} />
          <FilterPill label="Show deleted" active={status === 'all'} onClick={() => setStatus('all')} />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-bg-surface" />
          ))}
        </div>
      ) : playlists.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <ListMusic className="mx-auto mb-3 h-8 w-8 text-text-tertiary" />
          <p className="text-sm text-text-secondary">No playlists found</p>
          <p className="mb-4 mt-1 text-xs text-text-tertiary">
            Import from Spotify, Tidal, or Beatport to populate this view
          </p>
          <div className="flex justify-center gap-2">
            <button
              onClick={() => syncService('tidal')}
              className="flex items-center gap-2 rounded-lg bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-400"
            >
              <Download size={14} /> Import Tidal
            </button>
            <button
              onClick={() => syncService('beatport')}
              className="flex items-center gap-2 rounded-lg bg-orange-500/10 px-3 py-2 text-xs font-medium text-orange-400"
            >
              <Download size={14} /> Import Beatport
            </button>
            <button
              onClick={() => syncService('spotify')}
              className="flex items-center gap-2 rounded-lg bg-green-500/10 px-3 py-2 text-xs font-medium text-green-400"
            >
              <Download size={14} /> Import Spotify
            </button>
          </div>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {playlists.map((pl, idx) => (
            <PlaylistCard
              key={pl.id}
              pl={pl}
              idx={idx}
              recommending={recommending ?? undefined}
              completed={completedRecommend ?? undefined}
              onRecommend={handleRecommend}
              onEdit={openEdit}
              onDelete={handleDelete}
              onSync={syncPlaylist}
              deleting={deletingId === pl.id}
              syncing={syncingId === pl.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
