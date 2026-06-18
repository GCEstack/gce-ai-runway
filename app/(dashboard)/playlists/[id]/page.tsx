'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeft,
  ExternalLink,
  Music,
  Save,
  Loader2,
  RefreshCw,
  Tag,
  CloudUpload,
  Check,
  X,
} from 'lucide-react'
import type { Playlist, Track } from '@/lib/types'
import { GlassCard } from '@/components/GlassCard'
import { AgentBadge } from '@/components/AgentBadge'
import { ServiceBadge } from '@/components/ServiceBadge'
import { StarRating } from '@/components/StarRating'
import { cn } from '@/lib/utils'

type Energy = 'low' | 'medium' | 'high' | 'peak'

const ENERGY_OPTIONS: { value: Energy; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  { value: 'high', label: 'High', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  { value: 'peak', label: 'Peak', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
]

function playlistUrl(pl: Playlist): string | null {
  if (!pl.external_id) return null
  return pl.service === 'spotify'
    ? `https://open.spotify.com/playlist/${pl.external_id}`
    : `https://tidal.com/playlist/${pl.external_id}`
}

export default function PlaylistDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Local form state for playlist metadata.
  const [tags, setTags] = useState('')
  const [comments, setComments] = useState('')
  const [energy, setEnergy] = useState<Energy | ''>('')
  const [rating, setRating] = useState<number | null>(null)

  const showToast = useCallback((message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 3000)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: plData, error: plError }, { data: trData, error: trError }] = await Promise.all([
        supabase.from('playlists').select('*').eq('id', id).single(),
        supabase.from('tracks').select('*').eq('playlist_id', id).order('discovered_at', { ascending: false }),
      ])

      if (plError || !plData) {
        router.push('/playlists')
        return
      }

      const pl = plData as Playlist
      setPlaylist(pl)
      setTracks((trData ?? []) as Track[])
      setTags(pl.tags ?? '')
      setComments(pl.comments ?? '')
      setEnergy(pl.energy ?? '')
      setRating(pl.rating ?? null)
    } finally {
      setLoading(false)
    }
  }, [id, router, supabase])

  useEffect(() => {
    load()
  }, [load])

  async function savePlaylistMetadata() {
    if (!playlist) return
    setSaving(true)
    const body = {
      tags: tags.trim() || null,
      comments: comments.trim() || null,
      energy: energy || null,
      rating,
    }
    const res = await fetch(`/api/playlists/${playlist.id}/metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) {
      showToast(data.error || 'Failed to save playlist metadata')
      return
    }
    setPlaylist((prev) =>
      prev
        ? {
            ...prev,
            tags: body.tags ?? '',
            comments: body.comments ?? '',
            energy: body.energy,
            rating: body.rating,
          }
        : prev
    )
    showToast('Playlist metadata saved')
  }

  async function syncDescriptionToTidal() {
    if (!playlist || playlist.service !== 'tidal' || !playlist.external_id) {
      showToast('Only Tidal playlists with an external ID can be synced')
      return
    }
    setSyncing(true)
    const res = await fetch(`/api/playlists/${playlist.id}/sync-description`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    const data = await res.json()
    setSyncing(false)
    showToast(res.ok ? 'Description synced to Tidal' : data.error || 'Tidal sync failed')
  }

  async function updateTrack(trackId: string, patch: Partial<Track>) {
    const body: Record<string, unknown> = { trackId }
    if (patch.tags !== undefined) body.tags = patch.tags
    if (patch.comments !== undefined) body.comments = patch.comments
    if (patch.keep_remove !== undefined) body.keep_remove = patch.keep_remove

    const res = await fetch(`/api/playlists/${id}/tracks`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) {
      showToast(data.error || 'Failed to update track')
      return false
    }
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, ...patch } : t)))
    return true
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-text-tertiary" />
      </div>
    )
  }

  if (!playlist) return null

  const url = playlistUrl(playlist)
  const dirty =
    tags !== (playlist.tags ?? '') ||
    comments !== (playlist.comments ?? '') ||
    energy !== (playlist.energy ?? '') ||
    rating !== (playlist.rating ?? null)

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg border border-white/[0.08] bg-bg-surface-solid px-4 py-2 text-sm text-text-primary shadow-xl">
          <Check size={14} className="text-emerald-400" />
          {toast}
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/playlists"
            className="mb-2 inline-flex items-center gap-1 text-xs text-text-tertiary transition-colors hover:text-text-primary"
          >
            <ArrowLeft size={12} /> Back to playlists
          </Link>
          <h1 className="font-display text-3xl text-text-primary">{playlist.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <AgentBadge agent={playlist.agent} />
            <ServiceBadge service={playlist.service} />
            {playlist.prompt_name && (
              <span className="text-xs text-text-tertiary">Prompt: {playlist.prompt_name}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-white/[0.15] hover:text-text-primary"
            >
              <ExternalLink size={16} /> Open
            </a>
          )}
          <button
            onClick={load}
            className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-2 text-text-secondary transition-colors hover:text-text-primary"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <GlassCard className="lg:col-span-1 p-5">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg text-text-primary">
            <Tag size={16} className="text-accent-gold" /> Playlist metadata
          </h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Tags</label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="comma, separated, tags"
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-gold/50 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Comments</label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Notes about this playlist..."
                rows={4}
                className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-gold/50 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-text-secondary">Energy</label>
              <div className="grid grid-cols-2 gap-2">
                {ENERGY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setEnergy(opt.value)}
                    className={cn(
                      'rounded-lg border px-2 py-1.5 text-xs font-medium transition-all',
                      energy === opt.value
                        ? opt.color
                        : 'border-white/[0.08] bg-white/[0.03] text-text-secondary hover:border-white/[0.15] hover:text-text-primary'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Rating</label>
              <StarRating value={rating} onChange={setRating} />
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={savePlaylistMetadata}
                disabled={!dirty || saving}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                  dirty
                    ? 'bg-accent-gold/10 text-accent-gold hover:bg-accent-gold/15'
                    : 'cursor-not-allowed border border-white/[0.08] bg-white/[0.03] text-text-tertiary'
                )}
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Save metadata
              </button>

              {playlist.service === 'tidal' && playlist.external_id && (
                <button
                  onClick={syncDescriptionToTidal}
                  disabled={syncing}
                  className="flex items-center justify-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-400 transition-colors hover:bg-cyan-500/15"
                >
                  {syncing ? <Loader2 size={16} className="animate-spin" /> : <CloudUpload size={16} />}
                  Sync to Tidal description
                </button>
              )}
            </div>
          </div>
        </GlassCard>

        <GlassCard className="lg:col-span-2 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg text-text-primary">
              <Music size={16} className="text-cyan-400" /> Tracks
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-text-secondary">
                {tracks.length}
              </span>
            </h2>
          </div>

          {tracks.length === 0 ? (
            <div className="py-12 text-center text-sm text-text-secondary">No tracks saved for this playlist yet.</div>
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
              {tracks.map((track) => (
                <TrackRow key={track.id} track={track} onUpdate={updateTrack} />
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  )
}

function TrackRow({
  track,
  onUpdate,
}: {
  track: Track
  onUpdate: (id: string, patch: Partial<Track>) => Promise<boolean>
}) {
  const [tags, setTags] = useState(track.tags ?? '')
  const [comments, setComments] = useState(track.comments ?? '')
  const [keepRemove, setKeepRemove] = useState(track.keep_remove ?? 'keep')
  const [saving, setSaving] = useState(false)

  const dirty =
    tags !== (track.tags ?? '') ||
    comments !== (track.comments ?? '') ||
    keepRemove !== (track.keep_remove ?? 'keep')

  async function save() {
    setSaving(true)
    const ok = await onUpdate(track.id, {
      tags: tags.trim() || null,
      comments: comments.trim() || null,
      keep_remove: keepRemove,
    })
    setSaving(false)
    if (!ok) {
      setTags(track.tags ?? '')
      setComments(track.comments ?? '')
      setKeepRemove(track.keep_remove ?? 'keep')
    }
  }

  return (
    <div
      className={cn(
        'group rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 transition-colors',
        keepRemove === 'remove' && 'opacity-60'
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text-primary">{track.title}</p>
          <p className="truncate text-xs text-text-secondary">
            {track.artist} {track.album ? `• ${track.album}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => setKeepRemove((v) => (v === 'keep' ? 'remove' : 'keep'))}
            title={keepRemove === 'keep' ? 'Keep' : 'Remove'}
            className={cn(
              'rounded-md p-1.5 transition-colors',
              keepRemove === 'keep'
                ? 'text-emerald-400 hover:bg-emerald-500/10'
                : 'text-rose-400 hover:bg-rose-500/10'
            )}
          >
            {keepRemove === 'keep' ? <Check size={14} /> : <X size={14} />}
          </button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="tags"
          className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-cyan-500/40 focus:outline-none"
        />
        <input
          type="text"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder="comment"
          className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-cyan-500/40 focus:outline-none"
        />
        <button
          onClick={save}
          disabled={!dirty || saving}
          className={cn(
            'flex items-center justify-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            dirty
              ? 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/15'
              : 'cursor-not-allowed border border-white/[0.06] bg-white/[0.03] text-text-tertiary'
          )}
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          Save
        </button>
      </div>
    </div>
  )
}
