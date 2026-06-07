'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Star } from 'lucide-react'
import type { Playlist, Rating } from '@/lib/types'

function Stars({
  value,
  onChange,
  readonly,
}: {
  value: number | null
  onChange?: (v: number) => void
  readonly?: boolean
}) {
  const [hovered, setHovered] = useState(0)
  const active = hovered || value || 0
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(n)}
          onMouseEnter={() => !readonly && setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          className="disabled:cursor-default"
        >
          <Star
            className={`w-4 h-4 transition-colors ${
              n <= active ? 'text-amber-400 fill-amber-400' : 'text-zinc-600'
            }`}
          />
        </button>
      ))}
    </div>
  )
}

interface PlaylistWithRatings extends Playlist {
  dekan?: Rating | null
  jim?: Rating | null
}

export default function RatingsPage() {
  const [rows, setRows] = useState<PlaylistWithRatings[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, { rating: number; feedback: string }>>({})

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id ?? null)

      const [{ data: playlists }, { data: allRatings }, { data: users }] = await Promise.all([
        supabase.from('playlists').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('ratings').select('*'),
        supabase.auth.admin ? Promise.resolve({ data: null }) : Promise.resolve({ data: null }),
      ])

      const ratingsByPlaylist: Record<string, Rating[]> = {}
      for (const r of (allRatings ?? []) as Rating[]) {
        if (!ratingsByPlaylist[r.playlist_id]) ratingsByPlaylist[r.playlist_id] = []
        ratingsByPlaylist[r.playlist_id].push(r)
      }

      const enriched = ((playlists ?? []) as Playlist[]).map(pl => {
        const rs = ratingsByPlaylist[pl.id] ?? []
        const myRating = rs.find(r => r.rated_by === user?.id)
        const otherRating = rs.find(r => r.rated_by !== user?.id)
        return { ...pl, dekan: myRating ?? null, jim: otherRating ?? null }
      })

      setRows(enriched)
      setLoading(false)
    }
    load()
  }, [])

  async function submitRating(playlistId: string) {
    const draft = drafts[playlistId]
    if (!draft?.rating) return
    setSubmitting(playlistId)
    const res = await fetch('/api/rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playlist_id: playlistId,
        rating: draft.rating,
        feedback: draft.feedback,
      }),
    })
    if (res.ok) {
      setDrafts(d => { const n = { ...d }; delete n[playlistId]; return n })
      // Reload
      setLoading(true)
      const supabase = createClient()
      const { data: allRatings } = await supabase.from('ratings').select('*')
      // Quick refresh
      setRows(prev =>
        prev.map(pl => {
          const rs = ((allRatings ?? []) as Rating[]).filter(r => r.playlist_id === pl.id)
          const myRating = rs.find(r => r.rated_by === currentUserId)
          const otherRating = rs.find(r => r.rated_by !== currentUserId)
          return { ...pl, dekan: myRating ?? null, jim: otherRating ?? null }
        })
      )
      setLoading(false)
    }
    setSubmitting(null)
  }

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white">Ratings</h1>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-4 animate-pulse h-20" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Ratings</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Rate playlists and compare with the other user</p>
      </div>

      {rows.length === 0 ? (
        <div className="card p-12 text-center">
          <Star className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">No playlists to rate yet</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-[1fr_200px_200px] border-b border-zinc-800">
            <div className="px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Playlist</div>
            <div className="px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">My Rating</div>
            <div className="px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Their Rating</div>
          </div>
          {rows.map(pl => {
            const draft = drafts[pl.id]
            const myRating = pl.dekan

            return (
              <div
                key={pl.id}
                className="grid grid-cols-[1fr_200px_200px] border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors"
              >
                {/* Playlist info */}
                <div className="px-5 py-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={pl.agent === 'KIMI' ? 'badge-kimi' : 'badge-claude'}>{pl.agent}</span>
                    <span className={pl.service === 'spotify' ? 'badge-spotify' : 'badge-tidal'}>{pl.service}</span>
                  </div>
                  <p className="text-sm font-medium text-white">{pl.name}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{pl.track_count} tracks · {new Date(pl.created_at).toLocaleDateString()}</p>
                </div>

                {/* My rating */}
                <div className="px-5 py-4">
                  {myRating ? (
                    <div>
                      <Stars value={myRating.rating} readonly />
                      {myRating.feedback && (
                        <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{myRating.feedback}</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Stars
                        value={draft?.rating ?? null}
                        onChange={v => setDrafts(d => ({ ...d, [pl.id]: { rating: v, feedback: d[pl.id]?.feedback ?? '' } }))}
                      />
                      {draft?.rating && (
                        <>
                          <input
                            className="input text-xs py-1"
                            placeholder="Feedback…"
                            value={draft.feedback ?? ''}
                            onChange={e => setDrafts(d => ({ ...d, [pl.id]: { ...d[pl.id], feedback: e.target.value } }))}
                          />
                          <button
                            onClick={() => submitRating(pl.id)}
                            disabled={submitting === pl.id}
                            className="btn-primary text-xs py-1 px-2"
                          >
                            {submitting === pl.id ? 'Saving…' : 'Save'}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Their rating */}
                <div className="px-5 py-4">
                  {pl.jim ? (
                    <div>
                      <Stars value={pl.jim.rating} readonly />
                      {pl.jim.feedback && (
                        <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{pl.jim.feedback}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-600">Not rated yet</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
