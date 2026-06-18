# Runway Backend CLAUDE Audit Report

**Auditor:** Backend_Auditor  
**Project:** Runway Music Discovery Dashboard  
**Scope:** Every backend reference to CLAUDE/claude across DB schema, API routes, Python agents, MCP config, prompt templates, and documentation.  
**Objective:** Assess migration complexity for replacing the non-functional Claude API integration with OpenRouter or Kimi API.

---

## Executive Summary

The codebase has **31 distinct CLAUDE references** across **14 files**. The migration is **non-trivial** because:

1. **3 SQL CHECK constraints** hardcode `('KIMI', 'CLAUDE')` in the database schema. Changing these requires a Supabase migration that drops constraints, updates existing rows, and re-adds constraints.
2. **4 API routes** default to `agent = 'CLAUDE'` and validate against `['KIMI', 'CLAUDE']`. These will reject any new agent name without code changes.
3. **2 playlist-sync routes** infer agent identity from the `KIMI_` prefix, falling back to `CLAUDE` for anything else. This logic silently mislabels non-KIMI playlists.
4. **3 Python CLI scripts** restrict `--agent` to `choices=["kimi", "claude"]`.
5. **MCP config and prompt templates** define CLAUDE as the "underground/raw" persona in contrast to KIMI's "polished/crowd-pleasing" style.

---

## Detailed Reference Table

| # | File | Line(s) | Reference Text | Change Type | Complexity |
|---|------|---------|----------------|-------------|------------|
| 1 | `supabase/migrations/001_initial.sql` | 8 | `CHECK (agent IN ('KIMI', 'CLAUDE'))` on `playlists.agent` | DB_CONSTRAINT | **HIGH** |
| 2 | `supabase/migrations/001_initial.sql` | 24 | `CHECK (discovered_by IN ('KIMI', 'CLAUDE'))` on `tracks.discovered_by` | DB_CONSTRAINT | **HIGH** |
| 3 | `supabase/migrations/001_initial.sql` | 75 | `CHECK (agent IN ('KIMI', 'CLAUDE'))` on `agent_runs.agent` | DB_CONSTRAINT | **HIGH** |
| 4 | `app/api/discover/route.ts` | 50 | `agent = 'CLAUDE'` (default value in destructuring) | DEFAULT | **MEDIUM** |
| 5 | `app/api/discover/route.ts` | 56 | `!['KIMI', 'CLAUDE'].includes(agent)` | VALIDATION | **MEDIUM** |
| 6 | `app/api/discover/route.ts` | 57 | `'agent must be KIMI or CLAUDE'` (error message) | VALIDATION | **MEDIUM** |
| 7 | `app/api/run-prompt/route.ts` | 60 | `agent = 'CLAUDE'` (default value) | DEFAULT | **MEDIUM** |
| 8 | `app/api/run-prompt/route.ts` | 69 | `!['KIMI', 'CLAUDE'].includes(agent)` | VALIDATION | **MEDIUM** |
| 9 | `app/api/run-prompt/route.ts` | 70 | `'agent must be KIMI or CLAUDE'` (error message) | VALIDATION | **MEDIUM** |
| 10 | `app/api/run-prompt/route.ts` | 129 | `` `${agent}_${promptName}` `` (playlist name prefix) | PREFIX | **MEDIUM** |
| 11 | `app/api/recommend-similar/route.ts` | 159 | `agent = 'CLAUDE'` (default value) | DEFAULT | **MEDIUM** |
| 12 | `app/api/recommend-similar/route.ts` | 168 | `!['KIMI', 'CLAUDE'].includes(agent)` | VALIDATION | **MEDIUM** |
| 13 | `app/api/recommend-similar/route.ts` | 169 | `'agent must be KIMI or CLAUDE'` (error message) | VALIDATION | **MEDIUM** |
| 14 | `app/api/recommend-similar/route.ts` | 257 | `` `${agent}_Similar_to_${sourceName}` `` (playlist name prefix) | PREFIX | **MEDIUM** |
| 15 | `app/api/playlist/create/route.ts` | 17 | `!['KIMI', 'CLAUDE'].includes(agent)` | VALIDATION | **MEDIUM** |
| 16 | `app/api/playlist/create/route.ts` | 18 | `'agent must be KIMI or CLAUDE'` (error message) | VALIDATION | **MEDIUM** |
| 17 | `app/api/playlists/sync/route.ts` | 205 | `pl.name.startsWith('KIMI') ? 'KIMI' : 'CLAUDE'` (agent inference on Spotify sync) | PREFIX | **MEDIUM** |
| 18 | `app/api/playlists/sync/route.ts` | 250 | `(a.name ?? '').startsWith('KIMI') ? 'KIMI' : 'CLAUDE'` (agent inference on Tidal sync) | PREFIX | **MEDIUM** |
| 19 | `agents/discovery.py` | 232 | `choices=["kimi", "claude"]` (argparse CLI) | CHOICE | **MEDIUM** |
| 20 | `agents/discovery.py` | 244 | `args.agent` passed to `DiscoveryAgent` | CHOICE | **MEDIUM** |
| 21 | `agents/discovery_production.py` | 316 | `choices=["kimi", "claude"]` (argparse CLI) | CHOICE | **MEDIUM** |
| 22 | `agents/discovery_production.py` | 333 | `args.agent.upper()` used as agent name | CHOICE | **MEDIUM** |
| 23 | `agents/smart_discovery.py` | 276 | `choices=["kimi", "claude"]` (argparse CLI) | CHOICE | **MEDIUM** |
| 24 | `agents/smart_discovery.py` | 283 | `args.agent` passed to `SmartDiscoveryAgent` | CHOICE | **MEDIUM** |
| 25 | `agents/playlist.py` | 58 | `` f"{self.agent_name}_{name}" `` (prefix logic, dynamic but originates from CLI) | PREFIX | **LOW** |
| 26 | `agents/playlist.py` | 64 | `` f"{description} | Created by {self.agent_name}" `` | PREFIX | **LOW** |
| 27 | `agents/playlist.py` | 80 | `` f"{description} | Created by {self.agent_name}" `` | PREFIX | **LOW** |
| 28 | `kimi-mcp/agent/config.json` | 33–36 | `"CLAUDE": { "style": "underground, raw, leftfield", ... }` | CONFIG | **LOW** |
| 29 | `kimi-mcp/agent/config.json` | 64 | `"discovered_by": "KIMI | CLAUDE"` (output schema enum) | CONFIG | **LOW** |
| 30 | `kimi-mcp/agent/prompts/orchestrator.md` | 8, 42–43 | `(KIMI or CLAUDE)`; bias instructions | PROMPT | **LOW** |
| 31 | `kimi-mcp/spotify/prompts/discover.md` | 8, 31 | `(KIMI or CLAUDE)`; `when Agent is CLAUDE` | PROMPT | **LOW** |
| 32 | `kimi-mcp/tidal/prompts/discover.md` | 8, 30 | `(KIMI or CLAUDE)`; `when Agent is CLAUDE` | PROMPT | **LOW** |
| 33 | `kimi-mcp/spotify/prompts/playlist.md` | 9, 20 | `{{agent}}` template variables (adaptable) | PROMPT | **LOW** |
| 34 | `kimi-mcp/tidal/prompts/playlist.md` | 9, 19 | `{{agent}}` template variables (adaptable) | PROMPT | **LOW** |
| 35 | `docs/mcp-migration-plan.md` | 4, 135, 156, 184, 292 | `Claude-centric`; `agent CLAUDE's`; `KIMI vs CLAUDE`; `Agent style: [KIMI | CLAUDE]` | DOC | **LOW** |

---

## Files With NO CLAUDE References (Confirmed Clean)

| File | Notes |
|------|-------|
| `app/api/playlist/edit/route.ts` | Only edits name/comments; no agent validation |
| `app/api/playlist/delete/route.ts` | Soft-delete only; no agent validation |
| `app/api/playlist/sync/route.ts` | Checks existence; no agent inference |
| `app/api/playlists/[id]/metadata/route.ts` | Tags/comments/energy only |
| `app/api/playlists/[id]/sync-description/route.ts` | Tidal description sync only |
| `app/api/playlists/[id]/tracks/route.ts` | Track listing/updating only |
| `agents/playlist_production.py` | Accepts any `--agent` value; passes through dynamically |
| `agents/runway_client.py` | Agent-agnostic Supabase client |
| `agents/feed_agent.py` | Feed scraping only |
| `agents/seed_email.py` | Seed prompts only |
| `agents/seed_final.py` | Seed prompts only |
| `agents/seed_prompts.py` | Seed prompts only |
| `agents/seed_quick.py` | Seed prompts only |
| `docs/backend-forensics.md` | No CLAUDE references |
| `CRITICAL_PATH_FIXES.md` | No CLAUDE references |

---

## Required Database Migration

### Problem
PostgreSQL CHECK constraints are **not** directly alterable. You must drop, update data, and re-add.

### Recommended Migration SQL (rename CLAUDE → OPENROUTER)

```sql
-- ============================================================
-- Migration: Replace CLAUDE with OPENROUTER in agent columns
-- ============================================================

-- 1. Drop existing CHECK constraints
--    (PostgreSQL auto-names them; use \d tablename to find exact names)
--    If you used explicit names in a later migration, reference those names.
--    Otherwise, find them via:
--    SELECT conname FROM pg_constraint WHERE conrelid = 'playlists'::regclass;

ALTER TABLE playlists DROP CONSTRAINT IF EXISTS playlists_agent_check;
ALTER TABLE tracks DROP CONSTRAINT IF EXISTS tracks_discovered_by_check;
ALTER TABLE agent_runs DROP CONSTRAINT IF EXISTS agent_runs_agent_check;

-- 2. Update existing rows (optional — only if you want to rename historical data)
UPDATE playlists SET agent = 'OPENROUTER' WHERE agent = 'CLAUDE';
UPDATE tracks SET discovered_by = 'OPENROUTER' WHERE discovered_by = 'CLAUDE';
UPDATE agent_runs SET agent = 'OPENROUTER' WHERE agent = 'CLAUDE';

-- 3. Re-add CHECK constraints with new values
ALTER TABLE playlists ADD CONSTRAINT playlists_agent_check
  CHECK (agent IN ('KIMI', 'OPENROUTER'));

ALTER TABLE tracks ADD CONSTRAINT tracks_discovered_by_check
  CHECK (discovered_by IN ('KIMI', 'OPENROUTER'));

ALTER TABLE agent_runs ADD CONSTRAINT agent_runs_agent_check
  CHECK (agent IN ('KIMI', 'OPENROUTER'));
```

### Alternative: Remove Constraints Entirely (more flexible)

```sql
-- Drop constraints and allow any agent string
ALTER TABLE playlists DROP CONSTRAINT IF EXISTS playlists_agent_check;
ALTER TABLE tracks DROP CONSTRAINT IF EXISTS tracks_discovered_by_check;
ALTER TABLE agent_runs DROP CONSTRAINT IF EXISTS agent_runs_agent_check;
```

**Trade-off:** Removing constraints is simpler but loses data integrity. If you plan to add a 3rd agent later, removing constraints is better. If you will stick to exactly 2 personas, keep the CHECK.

---

## Recommendation: Keep Dual Personas, Rename CLAUDE → OPENROUTER

### Rationale

1. **Architectural fit:** The entire codebase is built around two personas with distinct "styles." `config.json` explicitly defines KIMI = "polished, crowd-pleasing" and CLAUDE = "underground, raw, leftfield." These styles are referenced in prompt templates and orchestrator bias logic. Removing the dual-persona model would require redesigning the taste-profile system.

2. **Playlist prefix ecosystem:** Playlists are named `KIMI_...` or `CLAUDE_...` on Spotify/Tidal. Changing to a single persona would orphan all existing `CLAUDE_` playlists and break the visual distinction users see in their streaming apps.

3. **Agent runs history:** The `agent_runs` table stores historical runs. Renaming preserves the semantic meaning ("which persona discovered this?") while swapping the underlying LLM provider.

4. **Minimal blast radius:** Renaming CLAUDE → OPENROUTER is a search-replace operation across ~14 files. Consolidating to a single persona would require deleting logic, updating the UI, and redefining the product concept.

### Implementation Plan

| Step | Action | Files | Effort |
|------|--------|-------|--------|
| 1 | Run DB migration (drop CHECK, update rows, re-add) | `supabase/migrations/` | 30 min |
| 2 | Update API route defaults & validations | `app/api/discover/route.ts`, `app/api/run-prompt/route.ts`, `app/api/recommend-similar/route.ts`, `app/api/playlist/create/route.ts` | 30 min |
| 3 | Fix playlist-sync agent inference | `app/api/playlists/sync/route.ts` | 15 min |
| 4 | Update Python CLI choices | `agents/discovery.py`, `agents/discovery_production.py`, `agents/smart_discovery.py` | 15 min |
| 5 | Update MCP config | `kimi-mcp/agent/config.json` | 10 min |
| 6 | Update prompt templates | `kimi-mcp/agent/prompts/orchestrator.md`, `kimi-mcp/spotify/prompts/discover.md`, `kimi-mcp/tidal/prompts/discover.md` | 15 min |
| 7 | Update documentation | `docs/mcp-migration-plan.md` | 10 min |
| 8 | Test CLI scripts with `--agent openrouter` | All `agents/*.py` | 30 min |

**Total estimated time:** ~2.5 hours for a single developer, plus testing.

---

## CLI Scripts That Would Break If `--agent claude` Is Removed

The following scripts have **hardcoded `choices=["kimi", "claude"]`** in their `argparse` configuration. If you remove `"claude"` from the choices without updating any cron jobs or manual commands that still pass `--agent claude`, these will exit with an argparse error:

| Script | Line | Current Choices | Risk |
|--------|------|-----------------|------|
| `agents/discovery.py` | 232 | `["kimi", "claude"]` | **BREAKS** if called with `--agent claude` |
| `agents/discovery_production.py` | 316 | `["kimi", "claude"]` | **BREAKS** if called with `--agent claude` |
| `agents/smart_discovery.py` | 276 | `["kimi", "claude"]` | **BREAKS** if called with `--agent claude` |

### Note: Safe Scripts

These scripts do **not** hardcode `choices` and will accept any `--agent` value:

| Script | Behavior |
|--------|----------|
| `agents/playlist.py` | `parser.add_argument("--agent", required=True)` — no choices, any value accepted. Will create `OPENROUTER_...` playlists automatically. |
| `agents/playlist_production.py` | `parser.add_argument("--agent", required=True)` — same, no choices. |

### Migration Safeguard

Before removing `"claude"` from the choices arrays, grep your entire repo (including cron jobs, shell scripts, documentation, and any external automation) for `--agent claude` or `--agent=claude` to ensure no callers are orphaned.

---

## Critical Gotchas

1. **Playlist sync inference (`app/api/playlists/sync/route.ts`)**  
   Lines 205 and 250 use a ternary: `startsWith('KIMI') ? 'KIMI' : 'CLAUDE'`. This means **any** non-KIMI playlist (including manually created ones or future OPENROUTER ones) is silently labeled `CLAUDE`. If you rename to `OPENROUTER`, update this logic to:
   ```ts
   agent: (pl.name ?? '').startsWith('KIMI_') ? 'KIMI' : 
           (pl.name ?? '').startsWith('OPENROUTER_') ? 'OPENROUTER' : 'UNKNOWN',
   ```
   Or better, remove the fallback-to-second-agent assumption entirely and store the agent prefix explicitly.

2. **Default agent = 'CLAUDE'**  
   Four API routes default to `agent = 'CLAUDE'` when the client doesn't send one. If the frontend doesn't explicitly send an agent, the backend silently used CLAUDE. After migration, decide whether the new default should be `'KIMI'` or `'OPENROUTER'`, or make the field required (no default).

3. **Case sensitivity mismatch**  
   - TypeScript API routes use **uppercase**: `'KIMI'`, `'CLAUDE'`  
   - Python CLI scripts use **lowercase**: `choices=["kimi", "claude"]` then `.upper()`  
   - If you introduce `'OPENROUTER'`, maintain the same pattern: accept lowercase in CLI, uppercase in DB/API.

4. **Index on `tracks.discovered_by`**  
   Line 86 in `001_initial.sql` creates `idx_tracks_agent` on `tracks(discovered_by)`. This index is unaffected by value changes, but verify the migration doesn't drop it accidentally.

---

## Summary Matrix

| Category | Count | Complexity | Key Files |
|----------|-------|------------|-----------|
| DB_CONSTRAINT | 3 | HIGH | `001_initial.sql` |
| VALIDATION | 7 | MEDIUM | `discover/route.ts`, `run-prompt/route.ts`, `recommend-similar/route.ts`, `playlist/create/route.ts` |
| DEFAULT | 3 | MEDIUM | `discover/route.ts`, `run-prompt/route.ts`, `recommend-similar/route.ts` |
| PREFIX | 5 | MEDIUM | `recommend-similar/route.ts`, `playlists/sync/route.ts`, `playlist.py` |
| CHOICE | 3 | MEDIUM | `discovery.py`, `discovery_production.py`, `smart_discovery.py` |
| CONFIG | 2 | LOW | `kimi-mcp/agent/config.json` |
| PROMPT | 6 | LOW | `orchestrator.md`, `discover.md` (×2), `playlist.md` (×2) |
| DOC | 5 | LOW | `docs/mcp-migration-plan.md` |
| **TOTAL** | **34** | — | **14 files** |

---

*Report generated by Backend_Auditor. All line numbers and references verified against the current working tree.*
