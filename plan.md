# Plan: Remove Claude API, Replace with OpenRouter/Kimi API — Runway Review

## Context
The Runway music discovery dashboard uses "KIMI" and "CLAUDE" as two agent personas. However, there is NO actual Anthropic Claude API integration in the codebase. "CLAUDE" is purely a branding label (playlist prefix, UI badge, DB constraint). The user intended to add a Claude API integration that never worked, and now wants to replace it with OpenRouter or Kimi API for actual LLM-powered prompt generation / curation.

## Key Files to Review & Modify

### Type System & Contracts
- `lib/types.ts` — `Agent = 'KIMI' | 'CLAUDE'` must change or expand
- `supabase/migrations/001_initial.sql` — DB CHECK constraints on `agent` and `discovered_by`

### API Routes (all validate `agent` field)
- `app/api/discover/route.ts` — discovery endpoint, defaults to `agent = 'CLAUDE'`
- `app/api/run-prompt/route.ts` — prompt runner, defaults to `agent = 'CLAUDE'`
- `app/api/recommend-similar/route.ts` — similar recommendations, defaults to `agent = 'CLAUDE'`
- `app/api/playlist/create/route.ts` — playlist creation

### Frontend Components
- `app/(dashboard)/page.tsx` — AgentFeed component with CLAUDE hardcoded
- `app/(dashboard)/playlists/page.tsx` — FilterPill for CLAUDE, create playlist defaults to CLAUDE
- `app/(dashboard)/tracks/page.tsx` — agent filter includes CLAUDE
- `app/(dashboard)/feed/page.tsx` — feed discovery defaults to CLAUDE
- `app/(dashboard)/prompts/page.tsx` — prompts page defaults to CLAUDE
- `components/AgentBadge.tsx` — styling for CLAUDE badge
- `app/layout.tsx` — meta description mentions CLAUDE
- `app/globals.css` — CSS variables for agent colors
- `tailwind.config.ts` — tailwind color mappings

### Python Agents
- `agents/discovery.py` — CLI accepts `--agent` with choices `["kimi", "claude"]`
- `agents/discovery_production.py` — same choices
- `agents/smart_discovery.py` — same choices
- `agents/playlist.py` — creates playlists with KIMI_/CLAUDE_ prefix
- `agents/playlist_production.py` — same
- `agents/runway_client.py` — Supabase client

### MCP / Prompt System
- `kimi-mcp/agent/config.json` — agent style definitions for KIMI and CLAUDE
- `kimi-mcp/agent/prompts/orchestrator.md` — references KIMI or CLAUDE
- `kimi-mcp/spotify/prompts/discover.md` — references KIMI or CLAUDE
- `kimi-mcp/tidal/prompts/discover.md` — references KIMI or CLAUDE
- `kimi-mcp/spotify/prompts/playlist.md` — references KIMI
- `kimi-mcp/tidal/prompts/playlist.md` — references KIMI

### Scripts & Docs
- `scripts/make-similar-tidal-playlist.mjs` — defaults to `agent: 'CLAUDE'`
- `scripts/sync-playlists.mjs` — infers agent from playlist name prefix
- `README.md` — mentions CLAUDE throughout
- `docs/mcp-migration-plan.md` — references CLAUDE agent style
- `MERGE_CHECKLIST.md` — references MCP config

## Stage 1: Parallel Multi-Agent Review
- **Agent 1 — Architecture Review**: Identify where LLM integration should go, what the new API should power (query generation, track curation, description generation?), and how to structure the OpenRouter/Kimi client
- **Agent 2 — Code Audit (Frontend)**: Catalog every frontend file that references CLAUDE, assess impact, identify defaults that should change
- **Agent 3 — Code Audit (Backend)**: Catalog every backend file (TS routes, Python agents, DB schema) that references CLAUDE, assess migration complexity
- **Agent 4 — Security & Config Review**: Review API key handling, env vars, and recommend secure patterns for OpenRouter/Kimi API keys

## Stage 2: Synthesis & PowerShell Prompt
- Integrate all reviews into a single actionable report
- Generate the Kimi Code PowerShell prompt for the user's local CLI review
- Produce a prioritized migration checklist
