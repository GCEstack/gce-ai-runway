'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ListMusic, RefreshCw, ExternalLink } from 'lucide-react'
import type { Playlist } from '@/lib/types'
import clsx from 'clsx'

type Filter = 'all' | 'spotify' | 'tidal' | 'KIMI' | 'CLAUDE'

function PlaylistCard({ pl }: { pl: Playlist }) {
  return (
    <div className="card p-4 hover:border-zinc-700 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={pl.agent === 'KIMI' ? 'badge-kimi' : 'badge-claude'}>{pl.agent}</span>
          <span className={pl.service === 'spotify' ? 'badge-spotify' : 'badge-tidal'}>{pl.service}</span>
        </div>
        {pl.external_id && (
          <a
            href={
              pl.service === 'spotify'
                ? `https://open.spotify.com/playlist/${pl.external_id}`
                : `https://tidal.com/playlist/${pl.external_id}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
      <p className="text-sm font-medium text-white leading-snug mb-1">{pl.name}</p>
      {pl.prompt_name && (
        <p className="text-xs text-zinc-500 mb-2">Prompt: {pl.prompt_name}</p>
      )}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800">
        <span className="text-xs text-zinc-400">
          <span className="font-medium text-white">{pl.track_count}</span> tracks
        </span>
        <span className="text-xs text-zinc-600">
          {new Date(pl.created_at).toLocaleDateString()}
        </span>
      </div>
    </div>
  )
}

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      let query = supabase.from('playlists').select('*').order('created_at', { ascending: false })
      if (filter === 'spotify' || filter === 'tidal') query = query.eq('service', filter)
      if (filter === 'KIMI' || filter === 'CLAUDE') query = query.eq('agent', filter)
      const { data } = await query
      setPlaylists((data ?? []) as Playlist[])
      setLoading(false)
    }
    load()
  }, [filter])

  const filters: { value: Filter; label: string }[] = [
    { value: 'all',    label: 'All' },
    { value: 'KIMI',   label: 'KIMI' },
    { value: 'CLAUDE', label: 'CLAUDE' },
    { value: 'spotify', label: 'Spotify' },
    { value: 'tidal',  label: 'Tidal' },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Playlists</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            KIMI_ and CLAUDE_ playlists across Spotify & Tidal
          </p>
        </div>
        <button onClick={() => setFilter('all')} className="btn-secondary">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {filters.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
              filter === f.value
                ? 'bg-violet-600/20 text-violet-300 border-violet-500/40'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700'
            )}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-zinc-500 self-center">
          {playlists.length} playlist{playlists.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card p-4 animate-pulse h-32" />
          ))}
        </div>
      ) : playlists.length === 0 ? (
        <div className="card p-12 text-center">
          <ListMusic className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">No playlists yet</p>
          <p className="text-xs text-zinc-600 mt-1">Run a discovery agent to create playlists</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {playlists.map(pl => <PlaylistCard key={pl.id} pl={pl} />)}
        </div>
      )}
    </div>
  )
}
