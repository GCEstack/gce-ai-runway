#!/usr/bin/env node
/**
 * Local Agent Runner Daemon
 *
 * This script runs on your local machine and polls Supabase for pending
 * agent runs. When it finds one, it executes the Python discovery agent
 * against your local Spotify/Tidal MCP servers and updates the run record.
 *
 * Usage:
 *   node scripts/agent-runner.mjs
 *
 * Required env vars (loaded from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// Load .env.local if present
function loadEnv() {
  try {
    const envPath = resolve(root, '.env.local')
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const [key, ...rest] = line.split('=')
      if (!key || rest.length === 0) continue
      const value = rest.join('=').trim().replace(/^["']|["']$/g, '')
      if (!(key in process.env)) process.env[key] = value
    }
  } catch {
    // ignore missing env file
  }
}

loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const POLL_INTERVAL_MS = 5000

function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args)
}

async function getPendingRuns() {
  const { data, error } = await supabase
    .from('agent_runs')
    .select('*')
    .eq('status', 'running')
    .is('completed_at', null)
    .order('started_at', { ascending: true })
    .limit(10)

  if (error) {
    log('ERROR fetching runs:', error.message)
    return []
  }
  return data ?? []
}

function runAgent(run) {
  return new Promise((resolve) => {
    const agent = run.agent?.toLowerCase()
    const promptName = run.prompt_name
    const runId = run.id

    if (!agent || !promptName) {
      log('WARNING: Skipping run with missing agent or prompt_name:', runId)
      resolve()
      return
    }

    log(`START discovery: agent=${agent.toUpperCase()} prompt="${promptName}" run=${runId}`)

    const args = [
      'agents/discovery_production.py',
      '--agent', agent,
      '--prompt', promptName,
      '--run-id', runId,
    ]

    const proc = spawn('python', args, {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
      },
    })

    proc.stdout.on('data', (chunk) => {
      process.stdout.write(chunk)
    })

    proc.stderr.on('data', (chunk) => {
      process.stderr.write(chunk)
    })

    proc.on('close', async (code) => {
      if (code !== 0) {
        log(`ERROR: Agent exited with code ${code} for run ${runId}`)
        try {
          await supabase
            .from('agent_runs')
            .update({ status: 'failed', completed_at: new Date().toISOString() })
            .eq('id', runId)
        } catch (e) {
          log('ERROR: Failed to mark run as failed:', e.message)
        }
      } else {
        log(`OK: Completed run ${runId}`)
      }
      resolve()
    })

    proc.on('error', (err) => {
      log('ERROR: Failed to spawn agent:', err.message)
      resolve()
    })
  })
}

async function tick() {
  const runs = await getPendingRuns()
  if (runs.length > 0) {
    log(`Found ${runs.length} pending run(s)`)
    for (const run of runs) {
      await runAgent(run)
    }
  }
}

async function main() {
  log('Agent runner started')
  log('Supabase:', SUPABASE_URL)
  log('Polling every', POLL_INTERVAL_MS, 'ms')
  log('Press Ctrl+C to stop')

  while (true) {
    try {
      await tick()
    } catch (e) {
      log('ERROR tick:', e.message)
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
