# Kimi Code PowerShell Prompt — Resume Implementation
# This prompt tells Kimi Code to pick up where it left off and start
# implementing the OpenRouter LLM integration and critical bug fixes.

$prompt = @"
You are continuing the Runway music discovery dashboard implementation. In the previous review, you completed a full code audit and produced an implementation plan. Now it is time to EXECUTE.

## Where We Left Off

The previous review concluded with:
- LLM recommendation: Use OpenRouter with a new lib/llm/ module (client.ts, prompts.ts, curation.ts, query-enhancer.ts, playlist-meta.ts). Map KIMI/CLAUDE to different system prompts on the same API.
- Migration strategy: Keep the CLAUDE persona name (Option A) to avoid a painful DB migration. Rebrand later if you want.
- Time estimate: ~22 hours for a working LLM integration; ~38 hours for full security hardening + optional rebrand.

## Your Mission: Implement Phase 1 + Phase 2

### Phase 1: Fix Critical Bugs (Do This FIRST)

These bugs are breaking the app RIGHT NOW:

1. **Fix `app/api/run-prompt/route.ts`** — Add `user_id: user.id` to the `playlists` insert (around line 146) and the `agent_runs` insert (around line 85). The route already has `user` from `supabase.auth.getUser()` at line 54. Just add `user_id: user.id` to both insert objects.

2. **Fix `app/api/discover/route.ts`** — Add `user_id: user.id` to the `agent_runs` insert (around line 80) and the `tracks` insert (around line 115). The route already has `user` from `supabase.auth.getUser()` at line 44.

3. **Create `supabase/migrations/009_ownership_tracks_agent_runs.sql`** — Add `user_id` columns to `tracks` and `agent_runs`, backfill existing rows to the earliest auth user, make them NOT NULL, add indexes, and tighten RLS policies. Use the exact SQL from the previous review.

4. **Fix `app/api/recommend-similar/route.ts`** — Add `user_id: user.id` to the `agent_runs` insert (around line 187) and the `playlists` insert (around line 272). Also add `user_id: user.id` to the `tracks` insert (around line 287).

5. **Fix `app/api/playlist/create/route.ts`** — Add `user_id: user.id` to the `playlists` insert (around line 22). The route already has `user` from `supabase.auth.getUser()` at line 8.

6. **Update `scripts/make-similar-tidal-playlist.mjs`** — Add `user_id` to the `playlists` POST body. You'll need to pass the user ID as a CLI argument or read it from an env var.

### Phase 2: Scaffold the LLM Layer

Create the `lib/llm/` module with real, working code:

7. **Create `lib/llm/types.ts`** — Copy the types from the previous review exactly. Include: `Persona`, `CurationInput`, `TrackCandidate`, `CuratedTrack`, `PlaylistMetaInput`, `PlaylistMeta`, `QueryEnhancerInput`, `EnhancedQueries`, `LLMOptions`.

8. **Create `lib/llm/prompts.ts`** — Implement `systemPrompt(persona)` returning the KIMI and CLAUDE system prompts. Implement `curationUserPrompt(persona, promptName, candidates, target)` returning the user prompt for track curation. Implement `playlistMetaPrompt(persona, prompt)` for playlist metadata generation. Implement `queryEnhancerPrompt(persona, sourcePlaylist, sourceTracks)` for smart query generation.

9. **Create `lib/llm/client.ts`** — Implement the OpenRouter HTTP client with:
   - `const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'`
   - `DEFAULT_MODELS: { KIMI: 'openai/gpt-4o', CLAUDE: 'anthropic/claude-3.5-sonnet' }`
   - `callLLM(opts)` with `AbortController`, 30s timeout, retry logic (3 retries with exponential backoff), error handling
   - Headers: `Authorization: Bearer OPENROUTER_API_KEY`, `HTTP-Referer`, `X-Title`
   - `response_format: { type: 'json_object' }` support
   - NEVER log the API key
   - Add `import 'server-only'` at the top

10. **Create `lib/llm/curation.ts`** — Implement `curateTracks(input)` that:
    - Formats candidates as a numbered list
    - Calls `callLLM` with the curation prompt
    - Parses JSON response safely (wrap in try/catch — fall back to raw candidates if JSON fails)
    - Maps results back to `CuratedTrack[]` with `score` and `curation_reason`
    - Sorts by score descending and slices to `targetCount`

11. **Create `lib/llm/playlist-meta.ts`** — Implement `generatePlaylistMeta(input)` that:
    - Calls `callLLM` with the playlist meta prompt
    - Parses JSON response safely (fallback to `${agent}_${promptName}` if fails)
    - Returns `{ name: string, description: string }`

12. **Create `lib/llm/query-enhancer.ts`** — Implement `enhanceQueries(input)` that:
    - Calls `callLLM` with the query enhancer prompt
    - Parses JSON response safely (fallback to deterministic `buildQueries` if fails)
    - Returns `{ queries: string[], reasoning: string }`

13. **Create `lib/llm/index.ts`** — Re-export all public functions for easy imports.

14. **Update `.env.local.example`** — Add the new LLM env vars:
    ```
    OPENROUTER_API_KEY=sk-or-v1-...
    LLM_MODEL_KIMI=openai/gpt-4o
    LLM_MODEL_CLAUDE=anthropic/claude-3.5-sonnet
    LLM_TIMEOUT_MS=30000
    LLM_MAX_RETRIES=3
    ```

### Phase 3: Integrate LLM into API Routes (If Time Allows)

15. **Update `app/api/discover/route.ts`** — After `deduplicateTracks(dateFiltered)` (around line 113), insert a curation step:
    ```typescript
    let finalResults = rawResults.slice(0, limit)
    try {
      finalResults = await curateTracks({
        persona: agent as Persona,
        promptName: promptName!,
        candidates: rawResults.map(t => ({ ... })),
        targetCount: limit,
      })
    } catch (e) {
      console.error('[Discover] LLM curation failed, using raw results:', e)
    }
    ```
    Persist `finalResults` instead of `rawResults`. If a track has `curation_reason`, include it in the `tracks` insert (you may need to add a `curation_reason` column to the `tracks` table, or just log it).

16. **Update `app/api/run-prompt/route.ts`** — After track selection, generate playlist metadata:
    ```typescript
    let playlistName = `${agent}_${promptName}`
    let description = `Generated by Runway from prompt: ${promptName}`
    try {
      const meta = await generatePlaylistMeta({
        persona: agent as Persona,
        promptName,
        genre: prompt.genre,
        energy: prompt.energy,
        bpmMin: prompt.bpm_min,
        bpmMax: prompt.bpm_max,
      })
      playlistName = meta.name
      description = meta.description
    } catch (e) {
      console.error('[RunPrompt] LLM meta failed, using default:', e)
    }
    ```
    Use `playlistName` and `description` when creating the Spotify/Tidal playlist.

17. **Update `app/api/recommend-similar/route.ts`** — Replace the `buildQueries` call with the LLM enhancer:
    ```typescript
    let queries: string[]
    try {
      const enhanced = await enhanceQueries({
        persona: agent as Persona,
        sourcePlaylist,
        sourceTracks,
        service,
      })
      queries = enhanced.queries
    } catch (e) {
      console.error('[RecommendSimilar] LLM query enhancement failed, using fallback:', e)
      queries = buildQueries(sourcePlaylist, sourceTracks)
    }
    ```
    Keep the existing `buildQueries` as the deterministic fallback.

## Rules for Implementation

1. **Never break existing behavior.** All LLM calls must be wrapped in try/catch with deterministic fallbacks.
2. **Never expose API keys.** The LLM client must be server-only. Add `import 'server-only'` to `lib/llm/client.ts`.
3. **Never log raw API keys.** Redact `Authorization` headers before logging.
4. **Preserve existing types.** Do NOT change `Agent = 'KIMI' | 'CLAUDE'` — keep Option A (no rebrand).
5. **Add comments** marking LLM integration points with `// LLM: ...` so future developers can find them.
6. **Test TypeScript compiles** after each file change. Run `npx tsc --noEmit` frequently.
7. **Check for existing files before creating.** If a file already exists, read it and update it, don't overwrite blindly.

## Output Format

For each file you modify or create, provide:
1. The file path
2. A brief description of what changed and why
3. The complete new file content (if new) or the specific diff (if modifying)

If you cannot complete all tasks in one session, explicitly tell me which files are DONE and which are PENDING so I can resume in the next session.

## Files to Read (if you need to check current state)
- lib/types.ts, lib/music.ts
- app/api/discover/route.ts, app/api/run-prompt/route.ts, app/api/recommend-similar/route.ts, app/api/playlist/create/route.ts
- app/api/playlists/sync/route.ts
- supabase/migrations/008_playlist_ownership.sql (to understand the current state)
- scripts/make-similar-tidal-playlist.mjs
- .env.local.example
- docs/security-audit.md, CRITICAL_PATH_FIXES.md

## IMPORTANT

- The project is at: C:\Users\Dekan AI Brother\Projects\ACTIVE\apps-platforms\runway
- Make sure you are in that directory before running any commands.
- If you need to install new npm packages (e.g., `lru-cache` for rate limiting), ask before installing.
- If you need to add columns to the database, write the SQL migration script and tell me to run it — do not assume the DB is already updated.
"@

# Write the prompt to a temp file
$tempFile = "$env:TEMP\runway-implementation-prompt.txt"
$prompt | Out-File -FilePath $tempFile -Encoding utf8

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Runway Implementation Prompt Ready" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "The implementation prompt has been saved to:" -ForegroundColor Yellow
Write-Host "  $tempFile" -ForegroundColor White
Write-Host ""
Write-Host "To run the implementation with Kimi Code CLI, use:" -ForegroundColor Green
Write-Host ""
Write-Host "  Option 1 - Copy-paste into Kimi Code chat:" -ForegroundColor White
Write-Host "    Get-Content `"$tempFile`" | Set-Clipboard" -ForegroundColor DarkCyan
Write-Host ""
Write-Host "  Option 2 - Direct prompt file (if kimi CLI supports it):" -ForegroundColor White
Write-Host "    kimi code --prompt-file `"$tempFile`"" -ForegroundColor DarkCyan
Write-Host ""
Write-Host "  Option 3 - Stdin pipe (if kimi CLI supports it):" -ForegroundColor White
Write-Host "    Get-Content `"$tempFile`" | kimi code -" -ForegroundColor DarkCyan
Write-Host ""
Write-Host "Prompt length: $($prompt.Length) characters" -ForegroundColor Gray
Write-Host ""
Write-Host "NOTE: Make sure you're in the project root:" -ForegroundColor Magenta
Write-Host "  cd C:\Users\Dekan AI Brother\Projects\ACTIVE\apps-platforms\runway" -ForegroundColor Magenta
Write-Host ""
Write-Host "This prompt tells Kimi Code to:" -ForegroundColor Cyan
Write-Host "  1. Fix user_id bugs in run-prompt, discover, recommend-similar, playlist/create routes" -ForegroundColor White
Write-Host "  2. Create migration 009 for tracks/agent_runs ownership" -ForegroundColor White
Write-Host "  3. Scaffold lib/llm/ module (client, types, prompts, curation, query-enhancer, playlist-meta)" -ForegroundColor White
Write-Host "  4. Integrate LLM into discover, run-prompt, and recommend-similar routes with try/catch fallbacks" -ForegroundColor White
Write-Host ""

# Optional: copy to clipboard automatically
Write-Host "Copying to clipboard now..." -ForegroundColor Green
Get-Content "$tempFile" | Set-Clipboard
Write-Host "Done! Paste into Kimi Code." -ForegroundColor Green
