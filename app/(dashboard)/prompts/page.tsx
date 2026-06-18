'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, SlidersHorizontal, Trash2, Pencil, X, Zap, Music2, Loader2, ExternalLink } from 'lucide-react'
import type { Prompt, Service } from '@/lib/types'
import { GlassCard } from '@/components/GlassCard'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/fetch-client'

const EMPTY_FORM = {
  name: '',
  label: '',
  genre: '',
  energy: '',
  bpm_min: '',
  bpm_max: '',
  timeframe: '',
  release_date_range: 'last_3_months',
  exclude_playlist: '',
  limit: '20',
  description: '',
}

interface RunningState {
  promptId: string
  service: Service
}

interface CompletedRun {
  promptId: string
  service: Service
  url: string
  trackCount: number
}

function PromptCard({
  prompt,
  onEdit,
  onDelete,
  running,
  completed,
  onRun,
}: {
  prompt: Prompt
  onEdit: (p: Prompt) => void
  onDelete: (id: string) => void
  running?: RunningState
  completed?: CompletedRun
  onRun: (promptId: string, service: Service) => void
}) {
  const isRunningSpotify = running?.promptId === prompt.id && running?.service === 'spotify'
  const isRunningTidal = running?.promptId === prompt.id && running?.service === 'tidal'
  const isRunningBeatport = running?.promptId === prompt.id && running?.service === 'beatport'
  const completedSpotify = completed?.promptId === prompt.id && completed?.service === 'spotify'
  const completedTidal = completed?.promptId === prompt.id && completed?.service === 'tidal'
  const completedBeatport = completed?.promptId === prompt.id && completed?.service === 'beatport'

  return (
    <GlassCard className="flex h-full flex-col p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="font-display text-xl text-text-primary">{prompt.name}</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(prompt)}
            className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-white/[0.06] hover:text-text-primary"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={() => onDelete(prompt.id)}
            className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-white/[0.06] hover:text-status-error"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {prompt.description && (
        <p className="mb-4 text-sm text-text-secondary">{prompt.description}</p>
      )}

      <div className="grid grid-cols-2 gap-2">
        {prompt.genre && <Param label="Genre" value={prompt.genre} />}
        {prompt.label && <Param label="Label" value={prompt.label} />}
        {prompt.energy && <Param label="Energy" value={prompt.energy} />}
        {(prompt.bpm_min || prompt.bpm_max) && (
          <Param label="BPM" value={`${prompt.bpm_min ?? '?'}–${prompt.bpm_max ?? '?'}`} />
        )}
        {prompt.timeframe && <Param label="Time" value={prompt.timeframe} />}
        {prompt.release_date_range && <Param label="Released" value={prompt.release_date_range.replace(/_/g, ' ')} />}
        <Param label="Limit" value={prompt.limit.toString()} />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <button
          onClick={() => onRun(prompt.id, 'tidal')}
          disabled={!!running}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
            completedTidal
              ? 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/15'
              : 'border border-white/[0.08] bg-white/[0.04] text-text-secondary hover:border-cyan-500/30 hover:text-cyan-400',
            isRunningTidal && 'cursor-wait opacity-70'
          )}
        >
          {isRunningTidal ? <Loader2 size={14} className="animate-spin" /> : <Music2 size={14} />}
          {completedTidal ? (
            <a href={completedTidal ? completed?.url : undefined} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
              Tidal <ExternalLink size={12} />
            </a>
          ) : (
            'Run on Tidal'
          )}
        </button>
        <button
          onClick={() => onRun(prompt.id, 'beatport')}
          disabled={!!running}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
            completedBeatport
              ? 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/15'
              : 'border border-white/[0.08] bg-white/[0.04] text-text-secondary hover:border-orange-500/30 hover:text-orange-400',
            isRunningBeatport && 'cursor-wait opacity-70'
          )}
        >
          {isRunningBeatport ? <Loader2 size={14} className="animate-spin" /> : <Music2 size={14} />}
          {completedBeatport ? 'Beatport' : 'Run on Beatport'}
        </button>
        <button
          onClick={() => onRun(prompt.id, 'spotify')}
          disabled={!!running}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
            completedSpotify
              ? 'bg-green-500/10 text-green-400 hover:bg-green-500/15'
              : 'border border-white/[0.08] bg-white/[0.04] text-text-secondary hover:border-green-500/30 hover:text-green-400',
            isRunningSpotify && 'cursor-wait opacity-70'
          )}
        >
          {isRunningSpotify ? <Loader2 size={14} className="animate-spin" /> : <Music2 size={14} />}
          {completedSpotify ? (
            <a href={completedSpotify ? completed?.url : undefined} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
              Spotify <ExternalLink size={12} />
            </a>
          ) : (
            'Run on Spotify'
          )}
        </button>
      </div>
    </GlassCard>
  )
}

function Param({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
        {label}
      </div>
      <div className="font-mono text-sm text-text-primary">{value}</div>
    </div>
  )
}

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Prompt | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState<RunningState | null>(null)
  const [completed, setCompleted] = useState<CompletedRun | null>(null)
  const [runError, setRunError] = useState<string | null>(null)

  async function load() {
    const supabase = createClient()
    const { data } = await supabase.from('prompts').select('*').order('created_at', { ascending: false })
    setPrompts((data ?? []) as Prompt[])
  }

  useEffect(() => {
    load()
  }, [])

  function openCreate() {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(p: Prompt) {
    setEditTarget(p)
    setForm({
      name: p.name,
      label: p.label ?? '',
      genre: p.genre ?? '',
      energy: p.energy ?? '',
      bpm_min: p.bpm_min?.toString() ?? '',
      bpm_max: p.bpm_max?.toString() ?? '',
      timeframe: p.timeframe ?? '',
      release_date_range: p.release_date_range ?? 'last_3_months',
      exclude_playlist: p.exclude_playlist ?? '',
      limit: p.limit.toString(),
      description: p.description ?? '',
    })
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const payload = {
      name: form.name,
      label: form.label || null,
      genre: form.genre || null,
      energy: form.energy || null,
      bpm_min: form.bpm_min ? parseInt(form.bpm_min) : null,
      bpm_max: form.bpm_max ? parseInt(form.bpm_max) : null,
      timeframe: form.timeframe || null,
      release_date_range: form.release_date_range || 'last_3_months',
      exclude_playlist: form.exclude_playlist || null,
      limit: parseInt(form.limit) || 20,
      description: form.description || null,
    }
    if (editTarget) {
      await supabase.from('prompts').update(payload).eq('id', editTarget.id)
    } else {
      await supabase.from('prompts').insert(payload)
    }
    setSaving(false)
    setShowForm(false)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this prompt?')) return
    const supabase = createClient()
    await supabase.from('prompts').delete().eq('id', id)
    load()
  }

  async function handleRun(promptId: string, service: Service) {
    setRunning({ promptId, service })
    setRunError(null)
    try {
      const res = await apiFetch('/api/run-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt_id: promptId, agent: 'CLAUDE', service }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Run failed')
      setCompleted({ promptId, service, url: data.playlist.url, trackCount: data.playlist.track_count })
    } catch (err: any) {
      setRunError(err.message)
    } finally {
      setRunning(null)
    }
  }

  const F = (key: keyof typeof EMPTY_FORM) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  })

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-4xl text-text-primary">Prompts</h1>
          <p className="mt-1 text-sm text-text-secondary">Discovery prompt templates</p>
        </div>
        <button
          onClick={openCreate}
          className={cn(
            'hidden items-center gap-2 rounded-lg bg-accent-gold px-4 py-2 font-heading text-sm font-semibold text-black',
            'shadow-lg shadow-accent-gold/20 transition-all hover:-translate-y-0.5 hover:shadow-accent-gold/30 sm:flex'
          )}
        >
          <Plus size={18} />
          New Prompt
        </button>
      </header>

      {runError && (
        <div className="rounded-lg bg-status-error/10 px-3 py-2 text-sm text-status-error">
          {runError}
        </div>
      )}

      {prompts.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <SlidersHorizontal className="mx-auto mb-3 h-8 w-8 text-text-tertiary" />
          <p className="text-sm text-text-secondary">No prompts yet</p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {prompts.map((p) => (
            <PromptCard
              key={p.id}
              prompt={p}
              onEdit={openEdit}
              onDelete={handleDelete}
              running={running ?? undefined}
              completed={completed ?? undefined}
              onRun={handleRun}
            />
          ))}
        </div>
      )}

      <button
        onClick={openCreate}
        className={cn(
          'fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent-gold text-black shadow-lg shadow-accent-gold/30',
          'transition-transform hover:scale-105 active:scale-95 sm:hidden'
        )}
      >
        <Plus size={24} />
      </button>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-white/[0.08] bg-bg-surface-solid">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
              <h2 className="font-display text-xl text-text-primary">
                {editTarget ? 'Edit Prompt' : 'New Prompt'}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-full p-2 text-text-tertiary transition-colors hover:bg-white/[0.06] hover:text-text-primary"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  Name *
                </label>
                <input
                  {...F('name')}
                  required
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-tertiary focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/30"
                  placeholder="e.g. Peak Time Techno"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-tertiary">
                    Label
                  </label>
                  <input
                    {...F('label')}
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-tertiary focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/30"
                    placeholder="e.g. Drumcode"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-tertiary">
                    Genre
                  </label>
                  <input
                    {...F('genre')}
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-tertiary focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/30"
                    placeholder="e.g. Techno"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-tertiary">
                    Energy
                  </label>
                  <input
                    {...F('energy')}
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-tertiary focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/30"
                    placeholder="high / mid"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-tertiary">
                    BPM Min
                  </label>
                  <input
                    {...F('bpm_min')}
                    type="number"
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-tertiary focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/30"
                    placeholder="130"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-tertiary">
                    BPM Max
                  </label>
                  <input
                    {...F('bpm_max')}
                    type="number"
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-tertiary focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/30"
                    placeholder="145"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-tertiary">
                    Timeframe
                  </label>
                  <input
                    {...F('timeframe')}
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-tertiary focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/30"
                    placeholder="e.g. last 3 months"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-tertiary">
                    Released
                  </label>
                  <select
                    value={form.release_date_range}
                    onChange={(e) => setForm((f) => ({ ...f, release_date_range: e.target.value }))}
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/30"
                  >
                    <option value="last_3_months">Last 3 months</option>
                    <option value="last_6_months">Last 6 months</option>
                    <option value="last_year">Last year</option>
                    <option value="all">All time</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-tertiary">
                    Track Limit
                  </label>
                  <input
                    {...F('limit')}
                    type="number"
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-tertiary focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/30"
                    placeholder="20"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  Exclude Playlist
                </label>
                <input
                  {...F('exclude_playlist')}
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-tertiary focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/30"
                  placeholder="Playlist ID to exclude"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  Description
                </label>
                <textarea
                  {...F('description')}
                  className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-tertiary focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/30"
                  rows={2}
                  placeholder="What should the agent look for…"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent-gold px-4 py-2 font-heading text-sm font-semibold text-black shadow-lg shadow-accent-gold/20 transition-all hover:-translate-y-0.5 disabled:opacity-60"
                >
                  <Zap size={16} />
                  {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Prompt'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
