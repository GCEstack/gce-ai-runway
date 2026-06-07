import { createClient } from '@/lib/supabase/server'
import { Zap, Music2, SlidersHorizontal, Rss, TrendingUp, Clock, CheckCircle, XCircle } from 'lucide-react'
import type { AgentRun } from '@/lib/types'
import clsx from 'clsx'

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  accent: string
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</p>
        <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center', accent)}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
    </div>
  )
}

function AgentFeed({ agent, runs }: { agent: 'KIMI' | 'CLAUDE'; runs: AgentRun[] }) {
  const agentRuns = runs.filter(r => r.agent === agent)
  const color = agent === 'KIMI' ? 'violet' : 'cyan'

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className={agent === 'KIMI' ? 'badge-kimi' : 'badge-claude'}>{agent}</span>
        <span className="text-sm font-medium text-white">Recent Runs</span>
      </div>
      {agentRuns.length === 0 ? (
        <p className="text-sm text-zinc-500 py-6 text-center">No runs yet</p>
      ) : (
        <div className="space-y-2.5">
          {agentRuns.slice(0, 6).map(run => (
            <div key={run.id} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
              <div className="min-w-0">
                <p className="text-sm text-white truncate">{run.prompt_name ?? 'Unknown prompt'}</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {run.tracks_found} found · {run.tracks_matched} matched
                </p>
              </div>
              <div className="flex items-center gap-2 ml-3">
                {run.status === 'completed' && <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />}
                {run.status === 'running' && <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 animate-pulse" />}
                {run.status === 'failed' && <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
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
    supabase
      .from('prompts')
      .select('*', { count: 'exact', head: true }),
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
  const matchRate = runs.length > 0
    ? Math.round(
        runs.reduce((acc, r) => acc + (r.tracks_found > 0 ? r.tracks_matched / r.tracks_found : 0), 0) /
        runs.length * 100
      )
    : 0

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Today's Discoveries"
          value={todayTracks ?? 0}
          sub="tracks found today"
          icon={Music2}
          accent="bg-violet-500/20 text-violet-400"
        />
        <StatCard
          label="Match Rate"
          value={`${matchRate}%`}
          sub="avg across recent runs"
          icon={TrendingUp}
          accent="bg-cyan-500/20 text-cyan-400"
        />
        <StatCard
          label="Active Prompts"
          value={activePrompts ?? 0}
          sub="prompt templates"
          icon={SlidersHorizontal}
          accent="bg-amber-500/20 text-amber-400"
        />
        <StatCard
          label="Feed Items"
          value={feedItems ?? 0}
          sub="unprocessed items"
          icon={Rss}
          accent="bg-green-500/20 text-green-400"
        />
      </div>

      {/* Agent Feeds */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <AgentFeed agent="KIMI" runs={runs} />
        <AgentFeed agent="CLAUDE" runs={runs} />
      </div>

      {/* Recent Playlists Created Today */}
      {playlists && playlists.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-medium text-white mb-3">Playlists Created Today</h2>
          <div className="flex flex-wrap gap-2">
            {(playlists as { agent: string; track_count: number }[]).map((pl, i) => (
              <span
                key={i}
                className={pl.agent === 'KIMI' ? 'badge-kimi' : 'badge-claude'}
              >
                {pl.agent} · {pl.track_count} tracks
              </span>
            ))}
          </div>
        </div>
      )}

      {/* All Runs Table */}
      {runs.length > 0 && (
        <div className="card mt-4">
          <div className="px-5 py-3 border-b border-zinc-800">
            <h2 className="text-sm font-medium text-white">All Recent Runs</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Agent</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Prompt</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Found</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Matched</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Started</th>
                </tr>
              </thead>
              <tbody>
                {runs.slice(0, 10).map(run => (
                  <tr key={run.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                    <td className="px-5 py-3">
                      <span className={run.agent === 'KIMI' ? 'badge-kimi' : 'badge-claude'}>{run.agent}</span>
                    </td>
                    <td className="px-5 py-3 text-zinc-300">{run.prompt_name ?? '—'}</td>
                    <td className="px-5 py-3 text-right text-zinc-400">{run.tracks_found}</td>
                    <td className="px-5 py-3 text-right text-zinc-400">{run.tracks_matched}</td>
                    <td className="px-5 py-3">
                      <span className={clsx(
                        'text-xs font-medium',
                        run.status === 'completed' ? 'text-green-400' :
                        run.status === 'running'   ? 'text-amber-400' :
                                                     'text-red-400'
                      )}>
                        {run.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-zinc-500 text-xs">
                      {new Date(run.started_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
