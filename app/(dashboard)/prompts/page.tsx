'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, SlidersHorizontal, Trash2, Pencil, X, Zap } from 'lucide-react'
import type { Prompt } from '@/lib/types'

const EMPTY_FORM = {
  name: '', label: '', genre: '', energy: '',
  bpm_min: '', bpm_max: '', timeframe: '',
  exclude_playlist: '', limit: '20', description: '',
}

function PromptCard({
  prompt,
  onEdit,
  onDelete,
}: {
  prompt: Prompt
  onEdit: (p: Prompt) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm font-semibold text-white">{prompt.name}</p>
        <div className="flex gap-1.5">
          <button onClick={() => onEdit(prompt)} className="p-1 text-zinc-500 hover:text-white transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(prompt.id)} className="p-1 text-zinc-500 hover:text-red-400 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {prompt.description && (
        <p className="text-xs text-zinc-400 mb-3">{prompt.description}</p>
      )}
      <div className="flex flex-wrap gap-1.5 text-xs">
        {prompt.genre && (
          <span className="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">{prompt.genre}</span>
        )}
        {prompt.label && (
          <span className="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">{prompt.label}</span>
        )}
        {prompt.energy && (
          <span className="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">Energy: {prompt.energy}</span>
        )}
        {(prompt.bpm_min || prompt.bpm_max) && (
          <span className="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
            {prompt.bpm_min ?? '?'}–{prompt.bpm_max ?? '?'} BPM
          </span>
        )}
        {prompt.timeframe && (
          <span className="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">{prompt.timeframe}</span>
        )}
        <span className="bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded">limit {prompt.limit}</span>
      </div>
    </div>
  )
}

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Prompt | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  async function load() {
    const supabase = createClient()
    const { data } = await supabase.from('prompts').select('*').order('created_at', { ascending: false })
    setPrompts((data ?? []) as Prompt[])
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(p: Prompt) {
    setEditTarget(p)
    setForm({
      name: p.name, label: p.label ?? '', genre: p.genre ?? '',
      energy: p.energy ?? '', bpm_min: p.bpm_min?.toString() ?? '',
      bpm_max: p.bpm_max?.toString() ?? '', timeframe: p.timeframe ?? '',
      exclude_playlist: p.exclude_playlist ?? '',
      limit: p.limit.toString(), description: p.description ?? '',
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

  const F = (key: keyof typeof EMPTY_FORM) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value })),
  })

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Prompts</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Discovery prompt templates</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus className="w-4 h-4" /> New Prompt
        </button>
      </div>

      {prompts.length === 0 ? (
        <div className="card p-12 text-center">
          <SlidersHorizontal className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">No prompts yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {prompts.map(p => (
            <PromptCard key={p.id} prompt={p} onEdit={openEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-white">
                {editTarget ? 'Edit Prompt' : 'New Prompt'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-zinc-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
              <div>
                <label className="label">Name *</label>
                <input {...F('name')} required className="input" placeholder="e.g. Peak Time Techno" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Label</label>
                  <input {...F('label')} className="input" placeholder="e.g. Drumcode" />
                </div>
                <div>
                  <label className="label">Genre</label>
                  <input {...F('genre')} className="input" placeholder="e.g. Techno" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Energy</label>
                  <input {...F('energy')} className="input" placeholder="high / mid" />
                </div>
                <div>
                  <label className="label">BPM Min</label>
                  <input {...F('bpm_min')} type="number" className="input" placeholder="130" />
                </div>
                <div>
                  <label className="label">BPM Max</label>
                  <input {...F('bpm_max')} type="number" className="input" placeholder="145" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Timeframe</label>
                  <input {...F('timeframe')} className="input" placeholder="e.g. last 3 months" />
                </div>
                <div>
                  <label className="label">Track Limit</label>
                  <input {...F('limit')} type="number" className="input" placeholder="20" />
                </div>
              </div>
              <div>
                <label className="label">Exclude Playlist</label>
                <input {...F('exclude_playlist')} className="input" placeholder="Playlist ID to exclude" />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea
                  {...F('description')}
                  className="input resize-none"
                  rows={2}
                  placeholder="What should the agent look for…"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                  <Zap className="w-3.5 h-3.5" />
                  {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Prompt'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
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
