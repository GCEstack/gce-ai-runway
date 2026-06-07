import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const { prompt_id, agent = 'CLAUDE', feed_item_id } = body as {
    prompt_id?: string
    agent?: string
    feed_item_id?: string
  }

  if (!agent || !['KIMI', 'CLAUDE'].includes(agent)) {
    return NextResponse.json({ error: 'agent must be KIMI or CLAUDE' }, { status: 400 })
  }

  // Resolve prompt name
  let promptName: string | null = null
  if (prompt_id) {
    const { data: prompt } = await supabase.from('prompts').select('name').eq('id', prompt_id).single()
    promptName = prompt?.name ?? null
  } else if (feed_item_id) {
    const { data: fi } = await supabase.from('feed_items').select('title').eq('id', feed_item_id).single()
    promptName = fi ? `feed:${fi.title.slice(0, 40)}` : null
  }

  // Create agent run record
  const { data: run, error } = await supabase
    .from('agent_runs')
    .insert({ agent, prompt_name: promptName, status: 'running' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // In a real implementation, this would invoke the MCP agent process.
  // For now, we return the run ID so the caller can poll for completion.
  // The MCP agent (KIMI / Claude Code) is expected to:
  //   1. Use the appropriate MCP server (Spotify/Tidal)
  //   2. Search/discover tracks
  //   3. Update this agent_run with tracks_found, tracks_matched, status='completed'
  //   4. Insert discovered tracks into the tracks table

  return NextResponse.json({
    run_id: run.id,
    agent,
    prompt_name: promptName,
    status: 'running',
    message: 'Agent run created. Invoke your MCP agent with this run_id to proceed.',
  })
}
