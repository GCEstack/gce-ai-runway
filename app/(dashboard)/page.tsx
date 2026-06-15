import { createClient } from '@/lib/supabase/server'
import { Music, Target, SlidersHorizontal, Rss, CheckCircle2, XCircle } from 'lucide-react'
import type { AgentRun } from '@/lib/types'
import { GlassCard } from '@/components/GlassCard'
import { StatCard } from '@/components/StatCard'
import { AgentBadge } from '@/components/AgentBadge'
import { cn } from '@/lib/utils'

function statusIcon(status: string) {
  if (status === 'completed') return <CheckCircle2 size={14} className="text-status-success" />
  if (status === 'failed') return <XCircle size={14} className="text-status-error" />
  return <div className="status-dot-running" />
}

function AgentFeed({ agent, runs }: { agent: 'KIMI' | 'CLAUDE'; runs: AgentRun[] }) {
  const agentRuns = runs
    .filter((r) => r.agent === agent)
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
    .slice(0, 5)

  return (
    <GlassCard className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <AgentBadge agent={agent} />
        <span className="text-xs text-text-tertiary">Recent runs</span>
      </div>
      <div className="space-y-3">
        {agentRuns.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-tertiary">No runs yet</p>
        ) : (
          agentRuns.map((run) => (
            <div
              key={run.id}
              className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text-primary">
                  {run.prompt_name ?? 'Unknown prompt'}
                </p>
                <p className="text-xs text-text-tertiary">
                  {run.tracks_found} found · {run.tracks_matched} matched
                </p>
              </div>
              <div className="ml-3 flex items-center gap-2 text-xs font-medium">
                {statusIcon(run.status)}
                <span
                  className={cn(
                    run.status === 'completed' && 'text-status-success',
                    run.status === 'failed' && 'text-status-error',
                    run.status === 'running' && 'text-status-running'
                  )}
                >
                  {run.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </GlassCard>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [
    { count: todayTracks },
    { count: activePrompts },
    { count: feedItems },
    { data: recentRuns },
    { data: playlists },
  ] = await Promise.all([
    supabase
      .from('tracks')
      .select('*', { count: 'exact', head: true })
      .gte('discovered_at', today.toISOString()),
    supabase.from('prompts').select('*', { count: 'exact', head: true }),
    supabase
      .from('feed_items')
      .select('*', { count: 'exact', head: true })
      .eq('processed', false),
    supabase
      .from('agent_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(20),
    supabase
      .from('playlists')
      .select('agent, track_count')
      .gte('created_at', today.toISOString()),
  ])

  const runs = (recentRuns ?? []) as AgentRun[]
  const matchRate =
    runs.length > 0
      ? Math.round(
          (runs.reduce(
            (acc, r) => acc + (r.tracks_found > 0 ? r.tracks_matched / r.tracks_found : 0),
            0
          ) /
            runs.length) *
            100
        )
      : 0

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-4xl text-text-primary">Dashboard</h1>
        <p className="mt-1 text-sm text-text-secondary">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Music} iconColor="#a78bfa" value={todayTracks ?? 0} label="Today's Discoveries" />
        <StatCard icon={Target} iconColor="#eab308" value={`${matchRate}%`} label="Match Rate" />
        <StatCard icon={SlidersHorizontal} iconColor="#64748b" value={activePrompts ?? 0} label="Active Prompts" />
        <StatCard icon={Rss} iconColor="#22d3ee" value={feedItems ?? 0} label="Feed Items" />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AgentFeed agent="KIMI" runs={runs} />
        <AgentFeed agent="CLAUDE" runs={runs} />
      </section>

      {playlists && playlists.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-tertiary">
            Playlists Created Today
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {(playlists as { agent: 'KIMI' | 'CLAUDE'; track_count: number }[]).map((pl, i) => (
              <GlassCard key={i} className="min-w-[220px] flex-shrink-0 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <AgentBadge agent={pl.agent} small />
                </div>
                <div className="text-xs text-text-secondary">
                  <span className="font-medium text-text-primary">{pl.track_count}</span> tracks
                </div>
              </GlassCard>
            ))}
          </div>
        </section>
      )}

      {runs.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-tertiary">
            All Recent Runs
          </h2>
          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-xs uppercase tracking-wider text-text-tertiary">
                    <th className="px-5 py-3 font-medium">Agent</th>
                    <th className="px-5 py-3 font-medium">Prompt</th>
                    <th className="px-5 py-3 font-medium">Found</th>
                    <th className="px-5 py-3 font-medium">Matched</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Started</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {runs.slice(0, 10).map((run) => (
                    <tr key={run.id} className="hover:bg-white/[0.02]">
                      <td className="px-5 py-3">
                        <AgentBadge agent={run.agent} small />
                      </td>
                      <td className="px-5 py-3 text-text-primary">
                        {run.prompt_name ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-text-secondary">{run.tracks_found}</td>
                      <td className="px-5 py-3 text-text-secondary">{run.tracks_matched}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {statusIcon(run.status)}
                          <span
                            className={cn(
                              'text-xs font-medium capitalize',
                              run.status === 'completed' && 'text-status-success',
                              run.status === 'failed' && 'text-status-error',
                              run.status === 'running' && 'text-status-running'
                            )}
                          >
                            {run.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-xs text-text-tertiary">
                        {new Date(run.started_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </section>
      )}
    </div>
  )
}
