'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Music2, CheckCircle, Loader2 } from 'lucide-react'
import { GlassCard } from '@/components/GlassCard'
import { CopyButton } from '@/components/CopyButton'
import { cn } from '@/lib/utils'

interface TokenStatus {
  connected: boolean
  expires_at: string | null
  service_user_id: string | null
}

export default function SettingsPage() {
  const searchParams = useSearchParams()
  const [tidal, setTidal] = useState<TokenStatus | null>(null)
  const [spotify, setSpotify] = useState<TokenStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

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
      setLoading(false)
    }
    load()
  }, [])

  async function syncNow(service: 'tidal' | 'spotify') {
    setSyncing(service)
    setSyncMsg(null)
    const res = await fetch('/api/playlists/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service }),
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
