# Runway Multi-Agent Review Synthesis
## Remove Claude API → Replace with OpenRouter / Kimi API

**Date:** 2026-06-18  
**Project:** Runway — Music Discovery Dashboard for Dekan & Jim  
**Reviewers:** Architecture_Reviewer, Frontend_Auditor, Backend_Auditor, Security_Reviewer  
**Orchestrator:** Main Agent (Orchestrator)

---

## 1. Executive Summary

### Key Discovery: There Is No Actual Claude API Integration
The `CLAUDE` agent in the Runway codebase is **purely a cosmetic label**. There are zero calls to `anthropic.com`, `claude.ai`, or any LLM API. The discovery pipeline uses deterministic query-building (`label + genre + energy + BPM`) and direct Spotify/Tidal API calls. The `agent` parameter (KIMI/CLAUDE) is only stamped onto tracks as metadata.

### What the User Actually Needs
The user wants to **add a real LLM API layer** (OpenRouter or Kimi API) to power intelligent music curation, and **rebrand the CLAUDE persona** since the actual Claude API never worked. The dual-persona concept should be preserved but powered by a unified LLM backend with different system prompts.

### Recommended Strategy: Keep Two Personas, Power Both via OpenRouter
- **KIMI** → polished, mainstream, high-production (system prompt)
- **CLAUDE** → underground, raw, leftfield (system prompt)  
  *Both use the same OpenRouter API with different `system` prompts.*

Or, if the user wants to completely remove the CLAUDE brand: rename to **OPENROUTER** (or any new name) and keep the dual-persona architecture.

---

## 2. Synthesis of All Review Findings

### 2.1 Architecture Review Findings
**Current flow:** `buildQuery()` → `searchSpotify()` + `searchTidal()` → `filterByReleaseDate()` → `deduplicateTracks()` → save to DB. No intelligence anywhere.

**Where LLM should step in (priority order):**
1. **Track Curation (Priority 1)** — After raw search results, pass candidates to LLM with persona-specific system prompt. LLM returns best N tracks with `curation_reason`.
2. **Query Enhancement** — Replace naive string concatenation with natural-language understanding.
3. **Playlist Metadata** — Generate rich descriptions, tags, and creative names instead of static strings.
4. **Smart Similar Recommendations** — Replace regex/heuristic `buildQueries()` with vibe-aware query generation.

**Recommended file structure:**
```
lib/llm/
  client.ts          # OpenRouter HTTP client with retry, timeout, circuit breaker
  types.ts           # LLM request/response types
  prompts.ts         # KIMI / CLAUDE system prompts (or KIMI / OPENROUTER)
  curation.ts        # Track curation: rank/filter raw results
  query-enhancer.ts  # Natural language → optimized search queries
  playlist-meta.ts   # Playlist name, description, tag generation
```

**API Recommendation:** **OpenRouter** as primary. It gives access to Claude, GPT-4o, Kimi, DeepSeek under one key. Fun product fidelity: the CLAUDE persona can run on an actual Claude model. Keep `KIMI_API_KEY` as optional fallback.

### 2.2 Frontend Audit Findings
**13 files analyzed. 25 direct CLAUDE references.**

**5 hardcoded `agent: 'CLAUDE'` defaults** — these are silent bugs if the backend stops accepting CLAUDE:
| File | Line | Context |
|------|------|---------|
| `app/(dashboard)/playlists/page.tsx` | 418 | `handleRecommend` sends `agent: 'CLAUDE'` |
| `app/(dashboard)/feed/page.tsx` | 176 | `handleDiscover` sends `agent: 'CLAUDE'` |
| `app/(dashboard)/prompts/page.tsx` | 234 | `handleRun` sends `agent: 'CLAUDE'` |
| `scripts/make-similar-tidal-playlist.mjs` | 132 | Hardcoded `agent: 'CLAUDE'` |
| `scripts/sync-playlists.mjs` | 106 | Non-KIMI playlists fall back to `'CLAUDE'` |

**Other critical frontend changes:**
- `lib/types.ts` line 1: `Agent = 'KIMI' | 'CLAUDE'` → expand or rename
- `app/(dashboard)/page.tsx`: `AgentFeed` hardcoded to CLAUDE
- `app/(dashboard)/tracks/page.tsx`: filter pill for CLAUDE
- `components/AgentBadge.tsx`: CSS class references `agent-claude`
- `app/globals.css` + `tailwind.config.ts`: `--agent-claude` tokens
- `app/layout.tsx`: meta description mentions CLAUDE
- `README.md`: multiple CLAUDE references

### 2.3 Backend Audit Findings
**34 CLAUDE references across 14 files.**

**Database (HIGH complexity):**
- `supabase/migrations/001_initial.sql` has **3 CHECK constraints**:
  - `playlists.agent` — `CHECK (agent IN ('KIMI', 'CLAUDE'))`
  - `tracks.discovered_by` — `CHECK (discovered_by IN ('KIMI', 'CLAUDE'))`
  - `agent_runs.agent` — `CHECK (agent IN ('KIMI', 'CLAUDE'))`
- Postgres CHECK constraints are **not directly alterable**. Must: drop → update rows → re-add.

**API routes (MEDIUM complexity):**
- `app/api/discover/route.ts` — defaults to `agent = 'CLAUDE'`, validates `['KIMI', 'CLAUDE']`
- `app/api/run-prompt/route.ts` — defaults to `agent = 'CLAUDE'`, validates `['KIMI', 'CLAUDE']`
- `app/api/recommend-similar/route.ts` — defaults to `agent = 'CLAUDE'`, validates `['KIMI', 'CLAUDE']`
- `app/api/playlist/create/route.ts` — validates `['KIMI', 'CLAUDE']`
- `app/api/playlists/sync/route.ts` — inference logic: `startsWith('KIMI') ? 'KIMI' : 'CLAUDE'`

**Python agents (MEDIUM complexity):**
- `agents/discovery.py` — `choices=["kimi", "claude"]`
- `agents/discovery_production.py` — same
- `agents/smart_discovery.py` — same
- `agents/playlist.py` — dynamic prefix, no hardcoded choices (safe)
- `agents/playlist_production.py` — dynamic prefix, no hardcoded choices (safe)

**MCP / Prompts (LOW complexity):**
- `kimi-mcp/agent/config.json` — CLAUDE style definition
- `kimi-mcp/agent/prompts/orchestrator.md` — references CLAUDE
- `kimi-mcp/spotify/prompts/discover.md` — references CLAUDE
- `kimi-mcp/tidal/prompts/discover.md` — references CLAUDE
- `kimi-mcp/spotify/prompts/playlist.md` — `{{agent}}` template (adaptable)
- `kimi-mcp/tidal/prompts/playlist.md` — `{{agent}}` template (adaptable)

**Confirmed clean files (no CLAUDE references):**
- `app/api/playlist/edit/route.ts`
- `app/api/playlist/delete/route.ts`
- `app/api/playlist/sync/route.ts`
- `app/api/playlists/[id]/metadata/route.ts`
- `app/api/playlists/[id]/sync-description/route.ts`
- `app/api/playlists/[id]/tracks/route.ts`
- `agents/runway_client.py`
- `agents/feed_agent.py`
- `agents/seed_email.py`, `seed_final.py`, `seed_prompts.py`, `seed_quick.py`
- `docs/backend-forensics.md`
- `CRITICAL_PATH_FIXES.md`

### 2.4 Security Review Findings
**Current Security Score: 5 / 10**

**🔴 Two Critical Bugs Currently Breaking the App:**
1. `app/api/run-prompt/route.ts` and `app/api/discover/route.ts` insert playlists **without `user_id`**, but migration 008 made `user_id NOT NULL`. Every playlist creation will **HTTP 500**.
2. `tracks` and `agent_runs` tables still **lack `user_id` columns** entirely — ownership enforcement impossible.

**🟠 High-Severity Gaps:**
- OAuth tokens stored in **plaintext** in `user_tokens` (no app-level encryption)
- **No rate limiting** on any API route (dangerous once LLM API is added)
- **Missing HSTS header** in `next.config.mjs`
- `tracks` and `agent_runs` SELECT RLS is `USING (true)` — any authenticated user reads all data

**LLM Integration Security Recommendations:**
- Store `OPENROUTER_API_KEY` / `KIMI_API_KEY` as **server-only** env vars (never `NEXT_PUBLIC_`)
- Create `lib/llm.ts` with `import 'server-only'` and a CI guard against client-side import
- Rate limit: **10 req/min per user** for LLM, **30s timeout**, **3 retries** with exponential backoff
- Add **circuit breaker** for LLM failures
- **Never log the API key**
- Sanitize prompts before sending (strip injection patterns, truncate to 4000 chars)

---

## 3. Prioritized Action Plan

### Phase 0: Fix Critical Bugs (Do This FIRST — ~30 min)
- [ ] **CRITICAL:** Add `user_id: user.id` to playlist inserts in `app/api/run-prompt/route.ts` and `app/api/discover/route.ts`
- [ ] **CRITICAL:** Add `user_id` to `agent_runs` inserts in the same routes
- [ ] **CRITICAL:** Create migration `009` to add `user_id` columns to `tracks` and `agent_runs`
- [ ] **CRITICAL:** Tighten RLS policies for `tracks` and `agent_runs` to `user_id = auth.uid()`

### Phase 1: Rebrand CLAUDE → OPENROUTER (or Keep as CLAUDE) (~2.5 hours)
- [ ] **DB Migration:** Drop CHECK constraints, optionally update rows, re-add with new values (or remove constraints entirely for flexibility)
- [ ] **Type System:** Update `lib/types.ts` → `Agent = 'KIMI' | 'OPENROUTER'` (or keep `'CLAUDE'`)
- [ ] **API Routes:** Update defaults and validation arrays in `discover`, `run-prompt`, `recommend-similar`, `playlist/create`
- [ ] **Playlist Sync:** Fix `startsWith('KIMI') ? 'KIMI' : 'CLAUDE'` inference in `playlists/sync/route.ts`
- [ ] **Python Agents:** Update `choices` arrays in `discovery.py`, `discovery_production.py`, `smart_discovery.py`
- [ ] **Frontend:** Update filter pills, AgentBadge, CSS tokens, layout meta, README
- [ ] **Scripts:** Update `sync-playlists.mjs` and `make-similar-tidal-playlist.mjs`
- [ ] **MCP Config:** Update `kimi-mcp/agent/config.json` and prompt templates
- [ ] **Docs:** Update `README.md` and `docs/mcp-migration-plan.md`

### Phase 2: Scaffold LLM Layer (~2 hours)
- [ ] Create `lib/llm/` directory with `client.ts`, `types.ts`, `prompts.ts`
- [ ] Add `OPENROUTER_API_KEY`, `KIMI_API_KEY`, `LLM_MODEL_*` to `.env.local.example`
- [ ] Implement `chatCompletion()` with timeout, retry, error handling
- [ ] Add `import 'server-only'` guard
- [ ] Add rate-limiting middleware (Vercel KV / Upstash)

### Phase 3: Integrate LLM into Discovery (~3 hours)
- [ ] **Track Curation:** Add `curateTracks()` to `app/api/discover/route.ts`
- [ ] **Playlist Metadata:** Add `generatePlaylistMeta()` to `app/api/run-prompt/route.ts`
- [ ] **Smart Similar:** Replace `buildQueries()` with `generateSearchQueries()` in `app/api/recommend-similar/route.ts`
- [ ] **Python Bridge:** Add LLM HTTP client to `agents/discovery.py` (POST to internal API or call OpenRouter directly)

### Phase 4: Security Hardening (~4 hours)
- [ ] Add HSTS header to `next.config.mjs`
- [ ] Implement API rate limiting (general + LLM-specific)
- [ ] Add circuit breaker for LLM failures
- [ ] Add input sanitization before LLM calls
- [ ] Encrypt `user_tokens` at application level
- [ ] Run `npm audit fix`
- [ ] Write `SECURITY.md`

---

## 4. Two Migration Options

### Option A: Keep "CLAUDE" as the Persona Name (Recommended if you like the brand)
- **Pros:** Zero DB string changes. All existing playlists, tracks, and agent runs keep their labels. Minimal migration.
- **Cons:** Users may think you're still using Anthropic Claude. You need to clarify in docs that "CLAUDE" is just a persona name.
- **What to change:** Only the backend implementation (add LLM client), CSS colors, and prompt templates. No DB migration needed.

### Option B: Rename CLAUDE → OPENROUTER (or any new name)
- **Pros:** Clear signal that Claude API is gone. Clean branding.
- **Cons:** Requires DB migration (drop CHECK constraints, update rows, re-add). All existing `CLAUDE_` playlists in Spotify/Tidal need to be understood as legacy.
- **What to change:** Everything — types, DB constraints, API validations, frontend labels, CSS tokens, Python choices, README, docs.

**Orchestrator Recommendation:** Start with **Option A** (keep "CLAUDE" as the persona label). It gets the LLM working immediately without a painful DB migration. Do the rebrand later if you want. The user asked to "remove the claude api to use open router or kimi api for prompts" — the API is what changes, not necessarily the brand.

---

## 5. New Environment Variables Required

```bash
# ─── LLM Provider (OpenRouter — recommended) ───────────────────────────────────
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_SITE_URL=https://your-runway-url.vercel.app

# Fallback / Native Kimi API (optional)
KIMI_API_KEY=sk-...
KIMI_BASE_URL=https://api.moonshot.cn/v1

# Model Selection (per-task, so you can use cheap models for simple tasks)
LLM_MODEL_CURATE=anthropic/claude-3.5-sonnet
LLM_MODEL_QUERY=anthropic/claude-3.5-sonnet
LLM_MODEL_META=openai/gpt-4o-mini
LLM_MODEL_FALLBACK=moonshotai/kimi-k1.5

# LLM Safety & Rate Limiting
LLM_MAX_REQUESTS_PER_MINUTE=10
LLM_REQUEST_TIMEOUT_MS=30000
LLM_MAX_RETRIES=3

# Internal API (for Python agents to call Next.js LLM routes)
RUNWAY_INTERNAL_API=http://localhost:3000
RUNWAY_INTERNAL_API_KEY=rw-internal-...    # rotate this secret

# Application-level encryption (optional but recommended)
ENCRYPTION_KEY=your_32_byte_base64_key_here
```

---

## 6. File Reference Map (All Files That Need Change)

| File | Phase | Change Type | Complexity |
|------|-------|-------------|------------|
| `supabase/migrations/001_initial.sql` | 1 | DB constraints (if renaming) | HIGH |
| `supabase/migrations/009_ownership.sql` | 0 | Add `user_id` to tracks, agent_runs | HIGH |
| `lib/types.ts` | 1 | Expand/rename Agent type | MEDIUM |
| `app/api/discover/route.ts` | 0,1,3 | Add `user_id`, change default, add curation | MEDIUM |
| `app/api/run-prompt/route.ts` | 0,1,3 | Add `user_id`, change default, add metadata | MEDIUM |
| `app/api/recommend-similar/route.ts` | 1,3 | Change default, replace buildQueries | MEDIUM |
| `app/api/playlist/create/route.ts` | 1 | Update validation array | LOW |
| `app/api/playlists/sync/route.ts` | 1 | Fix inference logic | LOW |
| `agents/discovery.py` | 1,3 | Update CLI choices, add LLM bridge | MEDIUM |
| `agents/discovery_production.py` | 1,3 | Update CLI choices, add LLM bridge | MEDIUM |
| `agents/smart_discovery.py` | 1 | Update CLI choices | LOW |
| `agents/playlist.py` | 1 | Dynamic prefix (no change needed if keeping CLAUDE name) | LOW |
| `agents/playlist_production.py` | 1 | Dynamic prefix (no change needed) | LOW |
| `kimi-mcp/agent/config.json` | 1 | Update agent style definition | LOW |
| `kimi-mcp/agent/prompts/orchestrator.md` | 1 | Update references | LOW |
| `kimi-mcp/spotify/prompts/discover.md` | 1 | Update references | LOW |
| `kimi-mcp/tidal/prompts/discover.md` | 1 | Update references | LOW |
| `app/(dashboard)/page.tsx` | 1 | Update AgentFeed default | LOW |
| `app/(dashboard)/playlists/page.tsx` | 1 | Remove hardcoded default, update filter | LOW |
| `app/(dashboard)/tracks/page.tsx` | 1 | Update filter pill | LOW |
| `app/(dashboard)/feed/page.tsx` | 1 | Remove hardcoded default | LOW |
| `app/(dashboard)/prompts/page.tsx` | 1 | Remove hardcoded default | LOW |
| `components/AgentBadge.tsx` | 1 | Update CSS classes (if renaming) | LOW |
| `app/globals.css` | 1 | Rename CSS variables (if renaming) | LOW |
| `tailwind.config.ts` | 1 | Rename color keys (if renaming) | LOW |
| `app/layout.tsx` | 1 | Update meta description | LOW |
| `scripts/make-similar-tidal-playlist.mjs` | 1 | Change default | LOW |
| `scripts/sync-playlists.mjs` | 1 | Fix inference logic | LOW |
| `README.md` | 1 | Update examples | LOW |
| `docs/mcp-migration-plan.md` | 1 | Update references | LOW |
| `lib/llm/client.ts` | 2 | New file | MEDIUM |
| `lib/llm/types.ts` | 2 | New file | LOW |
| `lib/llm/prompts.ts` | 2 | New file | LOW |
| `lib/llm/curation.ts` | 3 | New file | MEDIUM |
| `lib/llm/query-enhancer.ts` | 3 | New file | MEDIUM |
| `lib/llm/playlist-meta.ts` | 3 | New file | MEDIUM |
| `lib/rate-limit.ts` | 4 | New file | MEDIUM |
| `next.config.mjs` | 4 | Add HSTS header | LOW |
| `.env.local.example` | 2 | Add LLM env vars | LOW |

---

## 7. DB Migration Scripts (If Renaming CLAUDE → OPENROUTER)

```sql
-- ============================================================
-- Migration: Replace CLAUDE with OPENROUTER in agent columns
-- ============================================================

-- 1. Drop existing CHECK constraints
ALTER TABLE playlists DROP CONSTRAINT IF EXISTS playlists_agent_check;
ALTER TABLE tracks DROP CONSTRAINT IF EXISTS tracks_discovered_by_check;
ALTER TABLE agent_runs DROP CONSTRAINT IF EXISTS agent_runs_agent_check;

-- 2. Update existing rows (optional — only if renaming historical data)
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

**Alternative (more flexible):** Drop constraints entirely and allow any agent string. This makes adding a 3rd agent later trivial.

---

## 8. OpenRouter Client Skeleton (Ready to Implement)

```typescript
// lib/llm/client.ts
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' };
}

export async function chatCompletion(req: LLMRequest) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL ?? '',
      'X-Title': 'Runway',
    },
    body: JSON.stringify(req),
    signal: controller.signal,
  });
  clearTimeout(timeout);
  
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  return res.json();
}
```

---

## 9. PowerShell Prompt for Kimi Code CLI Review

See the companion file: `kimi-code-review-prompt.ps1`

---

*Report synthesized by Orchestrator from 4 parallel specialist reviews.*
