'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Music2, CheckCircle, Loader2 } from 'lucide-react'
import { GlassCard } from '@/components/GlassCard'
import { CopyButton } from '@/components/CopyButton'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/fetch-client'

interface TokenStatus {
  connected: boolean
  expires_at: string | null
  service_user_id: string | null
}

interface BeatportGenre {
  id: number
  name: string
  slug: string
}

export default function SettingsPage() {
  const searchParams = useSearchParams()
  const [tidal, setTidal] = useState<TokenStatus | null>(null)
  const [spotify, setSpotify] = useState<TokenStatus | null>(null)
  const [beatport, setBeatport] = useState<TokenStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [syncAfterDate, setSyncAfterDate] = useState<string>('')

  const [beatportToken, setBeatportToken] = useState('')
  const [beatportConnecting, setBeatportConnecting] = useState(false)

  // Beatport genre preferences
  const [beatportGenres, setBeatportGenres] = useState<BeatportGenre[]>([])
  const [selectedGenres, setSelectedGenres] = useState<Set<number>>(new Set())
  const [genresLoading, setGenresLoading] = useState(false)
  const [genresSaving, setGenresSaving] = useState(false)
  const [showGenres, setShowGenres] = useState(false)

  const connected = searchParams.get('connected')
  const error = searchParams.get('error')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('user_tokens')
        .select('service, expires_at, service_user_id')
      const tidalTok = data?.find((t) => t.service === 'tidal')
      const spotifyTok = data?.find((t) => t.service === 'spotify')
      const beatportTok = data?.find((t) => t.service === 'beatport')
      setTidal(
        tidalTok
          ? {
              connected: true,
              expires_at: tidalTok.expires_at,
              service_user_id: tidalTok.service_user_id,
            }
          : { connected: false, expires_at: null, service_user_id: null }
      )
      setSpotify(
        spotifyTok
          ? {
              connected: true,
              expires_at: spotifyTok.expires_at,
              service_user_id: spotifyTok.service_user_id,
            }
          : { connected: false, expires_at: null, service_user_id: null }
      )
      setBeatport(
        beatportTok
          ? {
              connected: true,
              expires_at: beatportTok.expires_at,
              service_user_id: beatportTok.service_user_id,
            }
          : { connected: false, expires_at: null, service_user_id: null }
      )
      setLoading(false)
    }
    load()
  }, [])

  async function syncNow(service: 'tidal' | 'spotify' | 'beatport') {
    setSyncing(service)
    setSyncMsg(null)
    const payload: Record<string, unknown> = { service }
    if (syncAfterDate) payload.sync_after_date = new Date(syncAfterDate).toISOString()
    const res = await apiFetch('/api/playlists/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (res.ok) {
      setSyncMsg(`Synced ${data.synced} ${service} playlists to Runway`)
    } else {
      setSyncMsg(data.error)
    }
    setSyncing(null)
  }

  async function disconnectTidal() {
    const supabase = createClient()
    await supabase.from('user_tokens').delete().eq('service', 'tidal')
    setTidal({ connected: false, expires_at: null, service_user_id: null })
  }

  async function disconnectBeatport() {
    const supabase = createClient()
    await supabase.from('user_tokens').delete().eq('service', 'beatport')
    setBeatport({ connected: false, expires_at: null, service_user_id: null })
  }

  async function connectBeatport(e: React.FormEvent) {
    e.preventDefault()
    setBeatportConnecting(true)
    setSyncMsg(null)
    try {
      let tokenData: Record<string, unknown>
      try {
        tokenData = JSON.parse(beatportToken)
      } catch {
        setSyncMsg('Invalid JSON. Paste the full token response from the browser.')
        setBeatportConnecting(false)
        return
      }

      const res = await apiFetch('/api/beatport/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenData }),
      })
      const data = await res.json()
      if (res.ok) {
        setBeatport({ connected: true, expires_at: data.expires_at, service_user_id: data.username })
        setSyncMsg('Beatport connected successfully!')
        setBeatportToken('')
      } else {
        setSyncMsg(data.error || 'Beatport connection failed')
      }
    } catch (err: any) {
      setSyncMsg(err.message || 'Unexpected error')
    } finally {
      setBeatportConnecting(false)
    }
  }

  // Load Beatport genre preferences
  async function loadBeatportGenres() {
    if (!beatport?.connected) return
    setGenresLoading(true)
    try {
      const [genresRes, prefsRes] = await Promise.all([
        apiFetch('/api/beatport/genres'),
        apiFetch('/api/beatport/preferences'),
      ])

      if (genresRes.ok) {
        const genresData = await genresRes.json()
        setBeatportGenres(genresData.genres ?? [])
      }

      if (prefsRes.ok) {
        const prefsData = await prefsRes.json()
        const savedGenres = (prefsData.preferences?.genres as Array<{ id: number; name: string }>) ?? []
        setSelectedGenres(new Set(savedGenres.map((g) => g.id)))
      }
    } catch (err) {
      console.error('Failed to load Beatport genres:', err)
    } finally {
      setGenresLoading(false)
    }
  }

  async function saveBeatportGenres() {
    if (!beatport?.connected) return
    setGenresSaving(true)
    try {
      const genres = Array.from(selectedGenres).map((id) => {
        const g = beatportGenres.find((bg) => bg.id === id)
        return { id, name: g?.name ?? '' }
      })

      const res = await apiFetch('/api/beatport/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: { genres } }),
      })

      if (res.ok) {
        setSyncMsg('Beatport genre preferences saved!')
        setShowGenres(false)
      } else {
        const data = await res.json()
        setSyncMsg(data.error || 'Failed to save preferences')
      }
    } catch (err: any) {
      setSyncMsg(err.message || 'Unexpected error')
    } finally {
      setGenresSaving(false)
    }
  }

  function toggleGenre(id: number) {
    setSelectedGenres((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const spotifyCommand = 'node scripts/sync-playlists.mjs --spotify'
  const localCommand = `cd "C:\\Users\\Dekan AI Brother\\runway"
node scripts/sync-playlists.mjs --all`

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl text-text-primary">Settings</h1>
        <p className="mt-1 text-sm text-text-secondary">Connect your music accounts</p>
      </header>

      {connected === 'tidal' && (
        <div className="flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-3 text-sm text-cyan-300">
          <CheckCircle size={16} />
          Tidal connected successfully! Click &quot;Sync now&quot; to import your playlists.
        </div>
      )}
      {connected === 'beatport' && (
        <div className="flex items-center gap-2 rounded-lg border border-orange-500/20 bg-orange-500/10 p-3 text-sm text-orange-300">
          <CheckCircle size={16} />
          Beatport connected successfully! Click &quot;Sync now&quot; to import your charts.
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-status-error/20 bg-status-error/10 p-3 text-sm text-status-error">
          Error: {decodeURIComponent(error)}
        </div>
      )}
      {syncMsg && (
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-3 text-sm text-text-secondary">
          {syncMsg}
        </div>
      )}

      <div className="space-y-4">
        <GlassCard className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10">
                <Music2 size={24} className="text-cyan-400" />
              </div>
              <div>
                <h3 className="font-display text-xl text-text-primary">Tidal</h3>
                <div className="mt-1 flex items-center gap-2 text-sm text-text-secondary">
                  {loading ? (
                    <span className="text-text-tertiary">Loading…</span>
                  ) : tidal?.connected ? (
                    <>
                      <span className="h-2 w-2 rounded-full bg-status-success" />
                      Connected · user {tidal.service_user_id} · expires{' '}
                      {tidal.expires_at ? new Date(tidal.expires_at).toLocaleDateString() : '?'}
                    </>
                  ) : (
                    <>
                      <span className="h-2 w-2 rounded-full bg-status-error" />
                      Not connected
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {tidal?.connected ? (
                <>
                  <button
                    onClick={() => syncNow('tidal')}
                    disabled={syncing === 'tidal'}
                    className={cn(
                      'flex items-center gap-2 rounded-lg bg-accent-gold px-3 py-2 text-xs font-semibold text-black',
                      'shadow-lg shadow-accent-gold/20 transition-all hover:-translate-y-0.5 disabled:opacity-60'
                    )}
                  >
                    {syncing === 'tidal' && <Loader2 size={14} className="animate-spin" />}
                    Sync now
                  </button>
                  <button
                    onClick={disconnectTidal}
                    className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary"
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <a
                  href="/api/tidal/auth"
                  className={cn(
                    'rounded-lg bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-400',
                    'transition-colors hover:bg-cyan-500/15'
                  )}
                >
                  Connect Tidal
                </a>
              )}
            </div>
          </div>
          {tidal?.connected && (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="text-xs text-text-secondary">
                Only sync playlists created on or after:
              </label>
              <input
                type="date"
                value={syncAfterDate}
                onChange={(e) => setSyncAfterDate(e.target.value)}
                className="rounded-lg border border-white/[0.08] bg-black/40 px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent-gold"
              />
              {syncAfterDate && (
                <button
                  onClick={() => setSyncAfterDate('')}
                  className="text-xs text-text-tertiary hover:text-text-primary"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10">
                <Music2 size={24} className="text-orange-400" />
              </div>
              <div>
                <h3 className="font-display text-xl text-text-primary">Beatport</h3>
                <div className="mt-1 flex items-center gap-2 text-sm text-text-secondary">
                  {loading ? (
                    <span className="text-text-tertiary">Loading…</span>
                  ) : beatport?.connected ? (
                    <>
                      <span className="h-2 w-2 rounded-full bg-status-success" />
                      Connected · user {beatport.service_user_id} · expires{' '}
                      {beatport.expires_at ? new Date(beatport.expires_at).toLocaleDateString() : '?'}
                    </>
                  ) : (
                    <>
                      <span className="h-2 w-2 rounded-full bg-status-error" />
                      Not connected
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {beatport?.connected ? (
                <>
                  <button
                    onClick={() => syncNow('beatport')}
                    disabled={syncing === 'beatport'}
                    className={cn(
                      'flex items-center gap-2 rounded-lg bg-accent-gold px-3 py-2 text-xs font-semibold text-black',
                      'shadow-lg shadow-accent-gold/20 transition-all hover:-translate-y-0.5 disabled:opacity-60'
                    )}
                  >
                    {syncing === 'beatport' && <Loader2 size={14} className="animate-spin" />}
                    Sync now
                  </button>
                  <button
                    onClick={disconnectBeatport}
                    className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary"
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <form onSubmit={connectBeatport} className="flex flex-col gap-2 w-full">
                  <textarea
                    placeholder='Paste the full token JSON from browser DevTools (Network tab → token/ → Response)'
                    value={beatportToken}
                    onChange={(e) => setBeatportToken(e.target.value)}
                    required
                    rows={4}
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-tertiary focus:border-orange-500/50"
                  />
                  <button
                    type="submit"
                    disabled={beatportConnecting}
                    className={cn(
                      'rounded-lg bg-orange-500/10 px-4 py-2 text-sm font-medium text-orange-400',
                      'transition-colors hover:bg-orange-500/15 disabled:opacity-60'
                    )}
                  >
                    {beatportConnecting ? <Loader2 size={14} className="animate-spin" /> : 'Connect Beatport'}
                  </button>
                </form>
              )}
            </div>
          </div>
          {beatport?.connected && (
            <div className="mt-4 border-t border-white/[0.06] pt-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-text-secondary">
                  {selectedGenres.size > 0 ? (
                    <span>{selectedGenres.size} genre(s) selected for sync</span>
                  ) : (
                    <span className="text-text-tertiary">No genres selected — default charts will sync</span>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (!showGenres) {
                      loadBeatportGenres()
                    }
                    setShowGenres(!showGenres)
                  }}
                  disabled={genresLoading}
                  className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary"
                >
                  {genresLoading ? <Loader2 size={12} className="animate-spin" /> : showGenres ? 'Hide genres' : 'Pick genres'}
                </button>
              </div>

              {showGenres && (
                <div className="mt-3 rounded-lg border border-white/[0.06] bg-black/40 p-3">
                  {genresLoading ? (
                    <div className="flex items-center gap-2 text-sm text-text-tertiary">
                      <Loader2 size={14} className="animate-spin" />
                      Loading genres…
                    </div>
                  ) : beatportGenres.length === 0 ? (
                    <p className="text-sm text-text-tertiary">No genres available</p>
                  ) : (
                    <>
                      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-text-tertiary">
                        Select genres to sync charts from
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {beatportGenres.map((genre) => (
                          <label
                            key={genre.id}
                            className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-xs text-text-secondary transition-colors hover:border-white/[0.12]"
                          >
                            <input
                              type="checkbox"
                              checked={selectedGenres.has(genre.id)}
                              onChange={() => toggleGenre(genre.id)}
                              className="h-3.5 w-3.5 rounded border-white/[0.12] bg-transparent accent-orange-500"
                            />
                            <span className="truncate">{genre.name}</span>
                          </label>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedGenres(new Set())}
                          className="rounded-lg px-3 py-1.5 text-xs text-text-tertiary transition-colors hover:text-text-secondary"
                        >
                          Clear all
                        </button>
                        <button
                          onClick={saveBeatportGenres}
                          disabled={genresSaving}
                          className={cn(
                            'flex items-center gap-1.5 rounded-lg bg-orange-500/10 px-3 py-1.5 text-xs font-medium text-orange-400',
                            'transition-colors hover:bg-orange-500/15 disabled:opacity-60'
                          )}
                        >
                          {genresSaving && <Loader2 size={12} className="animate-spin" />}
                          Save preferences
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10">
                <Music2 size={24} className="text-green-400" />
              </div>
              <div>
                <h3 className="font-display text-xl text-text-primary">Spotify</h3>
                {loading ? (
                  <p className="mt-1 text-sm text-text-tertiary">Loading…</p>
                ) : spotify?.connected ? (
                  <p className="mt-1 text-sm text-text-secondary">
                    Connected · expires {spotify.expires_at ? new Date(spotify.expires_at).toLocaleDateString() : '?'}
                  </p>
                ) : (
                  <p className="mt-1 max-w-md text-sm text-text-secondary">
                    Not connected via dashboard — use local sync script
                  </p>
                )}
              </div>
            </div>
            {spotify?.connected && (
              <button
                onClick={() => syncNow('spotify')}
                disabled={syncing === 'spotify'}
                className={cn(
                  'flex items-center gap-2 rounded-lg bg-accent-gold px-3 py-2 text-xs font-semibold text-black',
                  'shadow-lg shadow-accent-gold/20 transition-all hover:-translate-y-0.5 disabled:opacity-60'
                )}
              >
                {syncing === 'spotify' && <Loader2 size={14} className="animate-spin" />}
                Sync now
              </button>
            )}
          </div>

          {!spotify?.connected && (
            <div className="mt-5 rounded-lg border border-white/[0.06] bg-black/40 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  Sync command
                </span>
                <CopyButton text={spotifyCommand} />
              </div>
              <pre className="overflow-x-auto font-mono text-sm text-green-400">{spotifyCommand}</pre>
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-5">
          <div className="mb-4 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-gold/10">
              <span className="font-mono text-lg text-accent-gold">&gt;_</span>
            </div>
            <div>
              <h3 className="font-display text-xl text-text-primary">Local Sync Script</h3>
              <p className="mt-1 max-w-xl text-sm text-text-secondary">
                Run from your local machine whenever you want to push fresh Spotify playlist data to Runway.
                Tidal playlists are synced from the dashboard above. Reads tokens from{' '}
                <code className="text-text-primary">~/.spotify-mcp-tokens.json</code>.
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-accent-gold/20 bg-black/40 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
                Run locally
              </span>
              <CopyButton text={localCommand} />
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-sm leading-relaxed text-accent-gold">
              {localCommand}
            </pre>
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
