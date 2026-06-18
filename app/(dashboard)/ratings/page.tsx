'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Star } from 'lucide-react'
import type { Playlist, Rating } from '@/lib/types'
import { GlassCard } from '@/components/GlassCard'
import { AgentBadge } from '@/components/AgentBadge'
import { ServiceBadge } from '@/components/ServiceBadge'
import { StarRating } from '@/components/StarRating'
import { cn } from '@/lib/utils'

interface PlaylistWithRatings extends Playlist {
  myRating?: Rating | null
  theirRating?: Rating | null
}

export default function RatingsPage() {
  const [rows, setRows] = useState<PlaylistWithRatings[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, { rating: number; feedback: string }>>({})
  const [otherUserName, setOtherUserName] = useState('Them')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setCurrentUserId(user?.id ?? null)

      const [{ data: playlists }, { data: allRatings }, { data: users }] = await Promise.all([
        supabase.from('playlists').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('ratings').select('*'),
        supabase.from('profiles').select('id, email'),
      ])

      const otherUser = (users ?? []).find((u: any) => u.id !== user?.id)
      if (otherUser?.email) {
        setOtherUserName(otherUser.email.split('@')[0])
      }

      const ratingsByPlaylist: Record<string, Rating[]> = {}
      for (const r of (allRatings ?? []) as Rating[]) {
        if (!ratingsByPlaylist[r.playlist_id]) ratingsByPlaylist[r.playlist_id] = []
        ratingsByPlaylist[r.playlist_id].push(r)
      }

      const enriched = ((playlists ?? []) as Playlist[]).map((pl) => {
        const rs = ratingsByPlaylist[pl.id] ?? []
        const myRating = rs.find((r) => r.rated_by === user?.id)
        const otherRating = rs.find((r) => r.rated_by !== user?.id)
        return { ...pl, myRating: myRating ?? null, theirRating: otherRating ?? null }
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
      setDrafts((d) => {
        const n = { ...d }
        delete n[playlistId]
        return n
      })
      setLoading(true)
      const supabase = createClient()
      const { data: allRatings } = await supabase.from('ratings').select('*')
      setRows((prev) =>
        prev.map((pl) => {
          const rs = ((allRatings ?? []) as Rating[]).filter((r) => r.playlist_id === pl.id)
          const myRating = rs.find((r) => r.rated_by === currentUserId)
          const otherRating = rs.find((r) => r.rated_by !== currentUserId)
          return { ...pl, myRating: myRating ?? null, theirRating: otherRating ?? null }
        })
      )
      setLoading(false)
    }
    setSubmitting(null)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-4xl text-text-primary">Ratings</h1>
        </header>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-bg-surface" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl text-text-primary">Ratings</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Rate playlists and compare with {otherUserName}
        </p>
      </header>

      {rows.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <Star className="mx-auto mb-3 h-8 w-8 text-text-tertiary" />
          <p className="text-sm text-text-secondary">No playlists to rate yet</p>
        </GlassCard>
      ) : (
        <>
          <GlassCard className="hidden overflow-hidden md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-xs uppercase tracking-wider text-text-tertiary">
                  <th className="px-5 py-3 font-medium">Playlist</th>
                  <th className="px-5 py-3 font-medium">My Rating</th>
                  <th className="px-5 py-3 font-medium">{otherUserName}'s Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {rows.map((pl) => {
                  const draft = drafts[pl.id]
                  return (
                    <tr key={pl.id} className="hover:bg-white/[0.02]">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col gap-1">
                            <AgentBadge agent={pl.agent} small />
                            <ServiceBadge service={pl.service} small />
                          </div>
                          <div>
                            <div className="font-medium text-text-primary">{pl.name}</div>
                            <div className="text-xs text-text-tertiary">
                              {pl.track_count} tracks · {new Date(pl.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {pl.myRating ? (
                          <div>
                            <StarRating value={pl.myRating.rating} readOnly />
                            {pl.myRating.feedback && (
                              <p className="mt-1 line-clamp-2 text-xs text-text-secondary">
                                {pl.myRating.feedback}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <StarRating
                              value={draft?.rating ?? null}
                              onChange={(v) =>
                                setDrafts((d) => ({
                                  ...d,
                                  [pl.id]: { rating: v, feedback: d[pl.id]?.feedback ?? '' },
                                }))
                              }
                            />
                            {draft?.rating ? (
                              <>
                                <input
                                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-xs text-text-primary outline-none placeholder:text-text-tertiary focus:border-accent-gold/50"
                                  placeholder="Feedback…"
                                  value={draft.feedback ?? ''}
                                  onChange={(e) =>
                                    setDrafts((d) => ({
                                      ...d,
                                      [pl.id]: { ...d[pl.id], feedback: e.target.value },
                                    }))
                                  }
                                />
                                <button
                                  onClick={() => submitRating(pl.id)}
                                  disabled={submitting === pl.id}
                                  className="rounded-lg bg-accent-gold px-2 py-1 text-xs font-semibold text-black transition-all hover:opacity-90 disabled:opacity-60"
                                >
                                  {submitting === pl.id ? 'Saving…' : 'Save'}
                                </button>
                              </>
                            ) : (
                              <span className="text-xs italic text-text-tertiary">Not rated yet</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {pl.theirRating ? (
                          <div>
                            <StarRating value={pl.theirRating.rating} readOnly />
                            {pl.theirRating.feedback && (
                              <p className="mt-1 line-clamp-2 text-xs text-text-secondary">
                                {pl.theirRating.feedback}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs italic text-text-tertiary">Not rated yet</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </GlassCard>

          <div className="grid grid-cols-1 gap-4 md:hidden">
            {rows.map((pl) => {
              const draft = drafts[pl.id]
              return (
                <GlassCard key={pl.id} className="p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <AgentBadge agent={pl.agent} small />
                        <ServiceBadge service={pl.service} small />
                      </div>
                      <div className="font-display text-lg text-text-primary">{pl.name}</div>
                      <div className="text-xs text-text-tertiary">
                        {pl.track_count} tracks · {new Date(pl.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 border-t border-white/[0.06] pt-3">
                    <div>
                      <div className="mb-1 text-xs font-medium text-text-tertiary">My Rating</div>
                      {pl.myRating ? (
                        <StarRating value={pl.myRating.rating} readOnly />
                      ) : (
                        <div className="space-y-2">
                          <StarRating
                            value={draft?.rating ?? null}
                            onChange={(v) =>
                              setDrafts((d) => ({
                                ...d,
                                [pl.id]: { rating: v, feedback: d[pl.id]?.feedback ?? '' },
                              }))
                            }
                          />
                          {draft?.rating ? (
                            <>
                              <input
                                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-xs text-text-primary outline-none placeholder:text-text-tertiary focus:border-accent-gold/50"
                                placeholder="Feedback…"
                                value={draft.feedback ?? ''}
                                onChange={(e) =>
                                  setDrafts((d) => ({
                                    ...d,
                                    [pl.id]: { ...d[pl.id], feedback: e.target.value },
                                  }))
                                }
                              />
                              <button
                                onClick={() => submitRating(pl.id)}
                                disabled={submitting === pl.id}
                                className="rounded-lg bg-accent-gold px-2 py-1 text-xs font-semibold text-black transition-all hover:opacity-90 disabled:opacity-60"
                              >
                                {submitting === pl.id ? 'Saving…' : 'Save'}
                              </button>
                            </>
                          ) : (
                            <span className="text-xs italic text-text-tertiary">Not rated yet</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="mb-1 text-xs font-medium text-text-tertiary">
                        {otherUserName}'s Rating
                      </div>
                      {pl.theirRating ? (
                        <StarRating value={pl.theirRating.rating} readOnly />
                      ) : (
                        <span className="text-xs italic text-text-tertiary">Not rated yet</span>
                      )}
                    </div>
                  </div>
                </GlassCard>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
