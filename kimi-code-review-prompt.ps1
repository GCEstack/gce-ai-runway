# Kimi Code PowerShell Prompt for Runway Review
# Run this in PowerShell to launch a Kimi Code CLI review of the Runway project
# focusing on removing the broken Claude API and replacing it with OpenRouter/Kimi API.

$prompt = @"
You are reviewing the Runway music discovery dashboard codebase. The project is a Next.js 14 + Supabase + Python application that discovers tracks across Spotify and Tidal. 

CRITICAL CONTEXT:
- The codebase uses two "agent" personas: KIMI (polished/mainstream) and CLAUDE (underground/raw).
- However, CLAUDE was never an actual LLM integration. There are ZERO calls to anthropic.com, claude.ai, or any LLM API. The 'agent' parameter is purely a cosmetic label stamped onto tracks.
- The user wants to REMOVE the broken Claude API concept and REPLACE it with a REAL LLM integration using OpenRouter or Kimi API.
- The discovery pipeline currently does: buildQuery(label+genre+energy+BPM) -> searchSpotify() + searchTidal() -> filterByReleaseDate() -> deduplicateTracks() -> save to DB. No intelligence anywhere.

YOUR MISSION — Do a complete review and produce these deliverables:

1. **CLAUDE Reference Audit**: Find EVERY file that references 'CLAUDE' or 'claude' (case-insensitive). For each file, list the exact line numbers and the context. Categorize each as: TYPE_SYSTEM, API_VALIDATION, HARD_DEFAULT, UI_LABEL, CSS_TOKEN, CLI_CHOICE, DB_CONSTRAINT, PROMPT_TEMPLATE, or DOCUMENTATION.

2. **Critical Bug Report**: The security audit found that `app/api/run-prompt/route.ts` and `app/api/discover/route.ts` insert playlists WITHOUT `user_id`, but migration 008 made `user_id NOT NULL`. These routes will HTTP 500 on every playlist creation. Also, `tracks` and `agent_runs` tables lack `user_id` columns entirely. Confirm these bugs and propose fixes.

3. **LLM Integration Architecture**: Design where an LLM client should be added. Recommend:
   - A `lib/llm/` module structure (client.ts, types.ts, prompts.ts, curation.ts, query-enhancer.ts, playlist-meta.ts)
   - Which API to use: OpenRouter (recommended) or Kimi API
   - How to map KIMI/CLAUDE personas to different system prompts on the same API
   - Integration points: app/api/discover/route.ts (track curation), app/api/run-prompt/route.ts (playlist metadata), app/api/recommend-similar/route.ts (smart query generation), agents/discovery.py (Python bridge)

4. **Migration Strategy**: Recommend whether to:
   - Option A: Keep "CLAUDE" as the persona name (just swap the backend API) — minimal migration, no DB changes
   - Option B: Rename CLAUDE to "OPENROUTER" or another name — requires DB migration (drop CHECK constraints, update rows, re-add)
   Provide pros/cons and the exact SQL migration script if Option B.

5. **Security Checklist**: Review:
   - How API keys should be stored (server-only env vars, never NEXT_PUBLIC_)
   - Rate limiting (10 req/min per user for LLM, 30s timeout, 3 retries)
   - Input sanitization before LLM calls
   - Circuit breaker for LLM failures
   - Current security gaps: plaintext OAuth tokens, no rate limiting, missing HSTS, permissive RLS

6. **Prioritized Action Plan**: Produce a numbered checklist ordered by: CRITICAL BUGS first, then DB migration, then LLM scaffolding, then integration, then security hardening. Estimate time for each item.

FILES TO READ (all in the project root):
- lib/types.ts, lib/music.ts
- app/api/discover/route.ts, app/api/run-prompt/route.ts, app/api/recommend-similar/route.ts, app/api/playlist/create/route.ts, app/api/playlists/sync/route.ts
- app/(dashboard)/page.tsx, app/(dashboard)/playlists/page.tsx, app/(dashboard)/tracks/page.tsx, app/(dashboard)/feed/page.tsx, app/(dashboard)/prompts/page.tsx
- components/AgentBadge.tsx, app/layout.tsx, app/globals.css, tailwind.config.ts
- agents/discovery.py, agents/discovery_production.py, agents/smart_discovery.py, agents/playlist.py, agents/playlist_production.py, agents/runway_client.py
- supabase/migrations/001_initial.sql
- kimi-mcp/agent/config.json, kimi-mcp/agent/prompts/orchestrator.md, kimi-mcp/spotify/prompts/discover.md, kimi-mcp/tidal/prompts/discover.md
- middleware.ts, next.config.mjs, .env.local.example
- README.md, docs/mcp-migration-plan.md, docs/security-audit.md, CRITICAL_PATH_FIXES.md

OUTPUT FORMAT: Return a structured markdown report with clear sections, line-numbered references, code snippets where helpful, and a final prioritized checklist. Be exhaustive — do not miss any CLAUDE reference.
"@

# Write the prompt to a temp file to avoid PowerShell argument length limits
$tempFile = "$env:TEMP\runway-review-prompt.txt"
$prompt | Out-File -FilePath $tempFile -Encoding utf8

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Runway Kimi Code Review Prompt Ready" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "The review prompt has been saved to:" -ForegroundColor Yellow
Write-Host "  $tempFile" -ForegroundColor White
Write-Host ""
Write-Host "To run the review with Kimi Code CLI, use one of these commands:" -ForegroundColor Green
Write-Host ""
Write-Host "  Option 1 - Direct prompt (if kimi CLI supports it):" -ForegroundColor White
Write-Host "    kimi code --prompt-file `"$tempFile`"" -ForegroundColor DarkCyan
Write-Host ""
Write-Host "  Option 2 - Copy-paste into Kimi Code chat:" -ForegroundColor White
Write-Host "    Get-Content `"$tempFile`" | Set-Clipboard" -ForegroundColor DarkCyan
Write-Host ""
Write-Host "  Option 3 - If kimi CLI takes stdin:" -ForegroundColor White
Write-Host "    Get-Content `"$tempFile`" | kimi code -" -ForegroundColor DarkCyan
Write-Host ""
Write-Host "Prompt length: $($prompt.Length) characters" -ForegroundColor Gray
Write-Host ""
Write-Host "NOTE: Make sure you're in the project root directory:" -ForegroundColor Magenta
Write-Host "  cd C:\Users\Dekan AI Brother\Projects\ACTIVE\apps-platforms\runway" -ForegroundColor Magenta
Write-Host ""

# Optional: also output the raw prompt to the console for easy copy-paste
Write-Host "--- RAW PROMPT (for copy-paste) ---" -ForegroundColor Cyan
Write-Host $prompt
Write-Host "--- END PROMPT ---" -ForegroundColor Cyan
