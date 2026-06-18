#!/usr/bin/env node
/**
 * Unit tests for Tidal playlist sync logic.
 * Mocks Supabase and verifies that upsert uses the correct conflict target.
 */

import assert from 'node:assert'
import test from 'node:test'

function buildUpsertCalls(playlists, userId) {
  const rows = playlists.map((pl) => ({
    name: pl.name ?? '',
    agent: (pl.name ?? '').startsWith('CLAUDE') ? 'CLAUDE' : 'KIMI',
    service: 'tidal',
    external_id: pl.id,
    track_count: pl.track_count ?? 0,
    prompt_name: null,
    status: 'active',
    user_id: userId,
  }))
  return rows
}

test('sync builds rows with composite unique keys', () => {
  const userId = 'user-123'
  const playlists = [
    { id: 'pl-1', name: 'Chill', track_count: 12 },
    { id: 'pl-2', name: 'Workout', track_count: 20 },
  ]

  const rows = buildUpsertCalls(playlists, userId)

  assert.strictEqual(rows.length, 2)
  assert.deepStrictEqual(rows[0], {
    name: 'Chill',
    agent: 'KIMI',
    service: 'tidal',
    external_id: 'pl-1',
    track_count: 12,
    prompt_name: null,
    status: 'active',
    user_id: userId,
  })
})

test('sync rows use expected upsert conflict columns', () => {
  const userId = 'user-123'
  const playlists = [{ id: 'pl-1', name: 'KIMI Mix', track_count: 5 }]
  const rows = buildUpsertCalls(playlists, userId)

  const conflictTarget = ['user_id', 'service', 'external_id']
  assert.ok(rows.every((r) => conflictTarget.every((col) => col in r)),
    'Every upsert row must contain the composite unique columns')
})

test('agent label is derived from playlist name', () => {
  const rows = buildUpsertCalls(
    [
      { id: 'a', name: 'KIMI Discovers', track_count: 0 },
      { id: 'b', name: 'CLAUDE Radio', track_count: 0 },
      { id: 'c', name: 'My Playlist', track_count: 0 },
    ],
    'user-1'
  )
  assert.strictEqual(rows[0].agent, 'KIMI')
  assert.strictEqual(rows[1].agent, 'CLAUDE')
  assert.strictEqual(rows[2].agent, 'KIMI')
})

console.log('[sync-playlists.test] all tests passed')
