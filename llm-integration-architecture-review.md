# Runway LLM Integration — Architecture Review Report

## 1. Current Flow Analysis

### 1.1 Discovery Pipeline (`app/api/discover/route.ts`)
The current discovery flow is **purely deterministic** — no LLM is involved at all:

1. **Query Construction**: `buildQuery(prompt)` concatenates `label`, `genre`, `energy`, and `BPM range` into a keyword string.
2. **API Search**: `searchSpotify()` and `searchTidal()` are called in parallel with the raw keyword query.
3. **Filtering**: `filterByReleaseDate()` drops tracks older than the prompt's `release_date_range`.
4. **Deduplication**: `deduplicateTracks()` removes duplicates by `title|artist` key.
5. **Persistence**: Tracks are inserted into `supabase.tracks` with `discovered_by = agent` (KIMI or CLAUDE).

**Key observation**: The `agent` parameter (KIMI/CLAUDE) is **only a label** — it affects nothing in the search logic. Both agents execute identical code paths.

### 1.2 Prompt Runner (`app/api/run-prompt/route.ts`)
This is a stricter version of the discover flow that creates an actual playlist on the target service. It uses the same `buildQuery()` logic, then calls `createSpotifyPlaylist()` or `createTidalPlaylist()`.

### 1.3 Similar Recommendations (`app/api/recommend-similar/route.ts`)
This is the most intelligent existing route, but it uses **hardcoded heuristics**, not an LLM:
- Extracts genre tags from playlist names via regex
- Builds keyword queries from top artists + metadata tags
- Scores candidate tracks with `scoreTrackRelevance()` (artist overlap, genre token matching, dance/rock classifier, recency boost)
- Ranks and slices top 20

### 1.4 Python Discovery Agent (`agents/discovery.py`)
The Python agent mirrors the TypeScript flow exactly: `build_query()` -> `spotify_search`/`tidal_search` via MCP -> release-date filter -> deduplicate. No LLM involvement.

### 1.5 MCP Prompts (`kimi-mcp/.../prompts/discover.md`)
These are **documentation/markdown prompts** for hypothetical MCP orchestration, but the actual Next.js routes never use them. The orchestrator prompt mentions apply KIMI bias / CLAUDE bias but there is no code that implements this bias — the MCP layer does not execute these prompts in the current flow.

---

## 2. Where Should the LLM Step In?

The LLM should **not** replace the search API calls (Spotify/Tidal search is cheap and fast). Instead, the LLM should act as a **curation, enhancement, and analysis layer** at three integration points:

| Integration Point | Current Gap | LLM Value |
|-------------------|-------------|-----------|
| **A. Query Enhancement** | `buildQuery()` does naive string concatenation. It cannot handle vague prompts like dark hypnotic techno for a 3 AM warehouse set. | LLM translates natural-language intent into optimized search queries, artist names, and label filters. |
| **B. Track Curation / Filtering** | No intelligent filtering beyond release date. The agent label (KIMI/CLAUDE) is ignored. | LLM scores/re-ranks results against a **persona-specific system prompt** (polished vs. underground) and returns the best `limit` tracks with a `curation_reason` for each. |
| **C. Playlist Description & Metadata** | Playlist descriptions are static. | LLM generates rich, genre-aware descriptions, suggests tags, names the playlist creatively, and writes track-by-track commentary. |
| **D. Similar Recommendations** | `recommend-similar` uses hardcoded regex + heuristic scoring. | LLM analyzes the source playlist's **vibe, not just keywords**, and generates novel search queries to find deeper cuts. |

**Recommended priority order**: **B first** (highest impact, minimal latency risk), then **A**, then **C**, then **D**.

---

## 3. Recommended File Structure

Create a dedicated LLM client layer under `lib/llm/` rather than a single flat file. This keeps the project organized as the LLM surface grows.

```
lib/
  llm/
    client.ts          # Core OpenRouter/Kimi HTTP client with streaming support
    types.ts           # LLM request/response types (CurationResult, EnhancedQuery, etc.)
    prompts.ts         # System prompt templates for KIMI and CLAUDE personas
    curation.ts        # Track curation: rank/filter raw API results via LLM
    query-enhancer.ts  # Natural-language prompt -> optimized search queries
    playlist-meta.ts   # Playlist name, description, tag generation
  music.ts             # Unchanged (Spotify/Tidal API wrappers)
  types.ts             # Add LLM-related types
```

**Why this structure?**
- `client.ts` is the single point of API auth, retry logic, and model selection.
- `prompts.ts` centralizes persona definitions so KIMI/CLAUDE behavior is version-controlled.
- Each submodule (`curation.ts`, `query-enhancer.ts`, `playlist-meta.ts`) has a clear, testable boundary.
- The Next.js API routes import only what they need (e.g., `import { curateTracks } from '@/lib/llm/curation'`).

---

## 4. KIMI vs. CLAUDE: Keep Two Personas or Collapse to One?

**Recommendation: Keep both personas**, but power them through the **same LLM API** with **different system prompts**.

### Justification

| Factor | Recommendation |
|--------|----------------|
| **Branding** | The UI, database schema, and user mental model already distinguish KIMI and CLAUDE. Removing one creates migration work. |
| **Utility** | Two personas serve a real purpose: Dekan and Jim have different taste profiles (see `config.json` preferences). KIMI = polished/mainstream, CLAUDE = underground/raw. This is a genuine product differentiator. |
| **Cost** | Using the same model with different prompts costs the same as using one prompt. There is no per-persona overhead. |
| **Technical simplicity** | The `Agent` type is already `'KIMI' | 'CLAUDE'`. Simply map `agent -> systemPrompt` in `lib/llm/prompts.ts` and pass it to the LLM client. |

### Implementation
```typescript
// lib/llm/prompts.ts
export function getSystemPrompt(agent: Agent): string {
  if (agent === 'KIMI') {
    return 'You are KIMI, a polished music curator. You prefer high-production, mainstream-friendly tracks with strong composition. Avoid overly experimental or abrasive selections. You value crowd-pleasing energy and label prestige.';
  }
  return 'You are CLAUDE, an underground music curator. You prefer raw, leftfield, lesser-known cuts. You value authenticity, sub-label deep cuts, and raw energy over polished production. You are not afraid of abrasive or experimental sounds.';
}
```

---

## 5. API Recommendation: OpenRouter vs. Kimi API

**Recommendation: Use OpenRouter** as the primary gateway, with a fallback to Kimi API if needed.

### Comparison Matrix

| Criteria | OpenRouter | Kimi API (Moonshot) |
|----------|------------|---------------------|
| **Model variety** | Access to Claude, GPT-4o, Kimi, DeepSeek, Llama, etc. | Only Kimi models (Kimi K1.5, Moonshot-v1) |
| **Cost** | Competitive; pay-per-token with unified pricing | Competitive for Chinese market; may be cheaper for Kimi models specifically |
| **Streaming** | Full SSE streaming support (`stream: true`) | Supports streaming |
| **Project alignment** | This is a **Kimi-centric project**, but OpenRouter lets you *actually run Claude models* under the CLAUDE persona — a nice product symmetry. | Native Kimi integration is simpler if you only want Kimi models. |
| **Key reliability** | One `OPENROUTER_API_KEY` unlocks many models. | One `KIMI_API_KEY` for one family. |
| **Future-proofing** | If a new model beats Claude on curation, swap the model string without changing providers. | Locked to Moonshot release cycle. |

### Proposed Model Assignment

| Persona | Default Model | Rationale |
|---------|---------------|-----------|
| **KIMI** | `anthropic/claude-3.5-sonnet` or `openai/gpt-4o` | Polished, structured output, excellent at following JSON schemas. |
| **CLAUDE** | `anthropic/claude-3.5-sonnet` or `anthropic/claude-3-opus` | Ironically, using the real Claude model under the CLAUDE persona is a nice Easter egg and the model excels at nuanced, underground taste reasoning. |
| **Budget tier** | `deepseek/deepseek-chat` or `moonshotai/kimi-k1.5` | Available via OpenRouter for cheap bulk curation. |

> **Note**: Since the project is already named Runway and uses a KIMI persona, using OpenRouter avoids the confusion of KIMI the persona vs Kimi the API provider. It also lets the CLAUDE persona run on an actual Claude model, which is a fun product fidelity win.

---

## 6. Integration Points — Routes & Request/Response Shapes

### 6.1 New `lib/llm/client.ts`

```typescript
// lib/llm/types.ts
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  response_format?: { type: 'json_object' };
}

export interface LLMResponse {
  id: string;
  choices: { message: { content: string } }[];
  usage?: { prompt_tokens: number; completion_tokens: number };
}

// lib/llm/client.ts
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

export async function chatCompletion(req: LLMRequest): Promise<LLMResponse> {
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL ?? '',
      'X-Title': 'Runway',
    },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  return res.json();
}
```

### 6.2 Integration Point A — `app/api/discover/route.ts` (Track Curation)

**Current gap**: After `searchSpotify`/`searchTidal` return raw results, there is no intelligent selection.

**Proposed change**: Insert a `curateTracks()` call between search and persistence.

```typescript
// In app/api/discover/route.ts, after line 113:
const rawResults = deduplicateTracks(dateFiltered);

// NEW: LLM curation layer (async, optional fallback if LLM fails)
let finalResults: DiscoveredTrack[] = rawResults.slice(0, limit);
try {
  finalResults = await curateTracks({
    agent: agent as Agent,
    prompt: prompt as Prompt,
    candidates: rawResults,
    targetCount: limit,
  });
} catch (e) {
  console.error('[Discover] LLM curation failed, falling back to raw results:', e);
}
```

**`curateTracks` request shape** (`lib/llm/curation.ts`):
```typescript
export interface CurateTracksInput {
  agent: Agent;
  prompt: Prompt;
  candidates: DiscoveredTrack[];
  targetCount: number;
}

export interface CuratedTrack extends DiscoveredTrack {
  curation_reason: string;
  relevance_score: number; // 0-100, LLM-assigned
}

export async function curateTracks(input: CurateTracksInput): Promise<CuratedTrack[]> {
  const systemPrompt = getSystemPrompt(input.agent);
  const userPrompt = `
You are curating ${input.targetCount} tracks for a playlist.

Prompt: ${input.prompt.name}
Genre: ${input.prompt.genre ?? 'any'}
Energy: ${input.prompt.energy ?? 'any'}
BPM: ${input.prompt.bpm_min ?? '?'}-${input.prompt.bpm_max ?? '?'}

Candidates:
${input.candidates.map((t, i) => `${i + 1}. ${t.title} by ${t.artist} (${t.source})`).join('\n')}

Return a JSON object with a "tracks" array containing exactly ${input.targetCount} selections. Each entry must include:
- track_index: 1-based index from the candidate list
- reason: one sentence explaining why this track fits the prompt and the ${input.agent} persona
- score: 0-100 relevance score
`;

  const res = await chatCompletion({
    model: process.env.LLM_MODEL_CURATE ?? 'anthropic/claude-3.5-sonnet',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.4,
    response_format: { type: 'json_object' },
    max_tokens: 4096,
  });

  // Parse JSON, map back to DiscoveredTrack[], slice to targetCount
}
```

### 6.3 Integration Point B — `app/api/run-prompt/route.ts` (Playlist Metadata)

**Current gap**: Playlist descriptions are static.

**Proposed change**: After track selection, generate a rich description and name.

```typescript
// In app/api/run-prompt/route.ts, replace lines 129-130:
const playlistName = `${agent}_${promptName}`; // static
const description = `Generated by Runway from prompt: ${promptName}`; // static

// NEW:
const meta = await generatePlaylistMeta({
  agent: agent as Agent,
  prompt: prompt as Prompt,
  tracks: uniqueTracks,
});
const playlistName = meta.name;        // e.g. CLAUDE: Raw Warehouse 3 AM
const description = meta.description;  // e.g. Deep, hypnotic cuts selected for...
```

### 6.4 Integration Point C — `app/api/recommend-similar/route.ts` (Smart Query Generation)

**Current gap**: `buildQueries()` uses regex and keyword heuristics.

**Proposed change**: Replace `buildQueries` with an LLM-powered query generator that understands the playlist's *vibe*.

```typescript
// Before:
const queries = buildQueries(sourcePlaylist, sourceTracks);

// After:
const queries = await generateSearchQueries({
  agent: agent as Agent,
  sourcePlaylist,
  sourceTracks,
  service,
});
// Returns: ["underground techno 130 bpm", "artist:X-db label:Drumcode", "raw hypnotic acid"]
```

### 6.5 Integration Point D — `agents/discovery.py` (Python LLM Bridge)

The Python agent is used for CLI/batch runs. It should call the same LLM layer. Since Python is already running in the same repo, the cleanest approach is:

**Option 1 (Recommended)**: Add a small internal HTTP client in `agents/discovery.py` that POSTs to a new `app/api/llm/curate` route (or directly to OpenRouter). This avoids duplicating prompt logic in Python.

```python
# agents/discovery.py — new helper
import os, requests

def llm_curate(agent_name: str, prompt: dict, candidates: list[dict], limit: int) -> list[dict]:
    res = requests.post(
        f"{os.getenv('RUNWAY_INTERNAL_API')}/api/llm/curate",
        json={"agent": agent_name, "prompt": prompt, "candidates": candidates, "limit": limit},
        headers={"Authorization": f"Bearer {os.getenv('RUNWAY_INTERNAL_API_KEY')}"},
    )
    res.raise_for_status()
    return res.json()["tracks"]
```

**Option 2**: If the Python agent needs to run standalone without the Next.js server, duplicate the OpenRouter client logic in a new `agents/llm_client.py` module, sharing the same `prompts/` directory.

---

## 7. Recommended Environment Variables

Add these to `.env.local` and `.env.local.example`:

```bash
# LLM Provider (OpenRouter)
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_SITE_URL=https://runway.local      # optional, for OpenRouter rankings

# Fallback / Native Kimi API
KIMI_API_KEY=sk-...                             # optional fallback
KIMI_BASE_URL=https://api.moonshot.cn/v1      # optional

# Model Selection
LLM_MODEL_CURATE=anthropic/claude-3.5-sonnet    # track curation (needs reasoning)
LLM_MODEL_QUERY=anthropic/claude-3.5-sonnet     # query enhancement
LLM_MODEL_META=anthropic/claude-3.5-sonnet      # playlist metadata (cheap, could be gpt-4o-mini)
LLM_MODEL_FALLBACK=moonshotai/kimi-k1.5         # budget fallback

# Internal Routing (for Python agent -> Next.js LLM bridge)
RUNWAY_INTERNAL_API=http://localhost:3000
RUNWAY_INTERNAL_API_KEY=rw-internal-...         # rotate this secret
```

**Why not just one model env var?**
- Curation is the most token-intensive task (sends a full candidate list). You may want a strong model for curation and a cheaper model for metadata generation.
- Query enhancement is low-token but high-stakes — a good model pays off in search result quality.
- The `FALLBACK` model lets you gracefully degrade if the primary model is rate-limited or expensive.

---

## 8. Implementation Roadmap (Recommended Order)

| Phase | Task | Files to Change | Est. Complexity |
|-------|------|-----------------|-----------------|
| **1** | Scaffold `lib/llm/` (client, types, prompts) | Create `lib/llm/*` | Low |
| **2** | Wire LLM curation into `app/api/discover/route.ts` | `app/api/discover/route.ts` | Medium |
| **3** | Add playlist metadata generation to `app/api/run-prompt/route.ts` | `app/api/run-prompt/route.ts`, `lib/llm/playlist-meta.ts` | Low |
| **4** | Replace `buildQueries` in `app/api/recommend-similar/route.ts` with LLM query generation | `app/api/recommend-similar/route.ts`, `lib/llm/query-enhancer.ts` | Medium |
| **5** | Bridge Python agent to LLM layer | `agents/discovery.py` | Low |
| **6** | Add streaming support (optional UX win) | `lib/llm/client.ts` + frontend | Medium |

---

## 9. Risk Notes

1. **Latency**: LLM curation adds 1-3 seconds per call (or 5-10s for large candidate lists). Consider making curation **async** (background job) or **optional** (user toggles Smart Curation).
2. **Token cost**: Sending 50 track candidates with title/artist/album to the LLM costs ~$0.01-$0.03 per curation. For 50 runs/day, that is ~$15-$45/month. Use the `LLM_MODEL_FALLBACK` for bulk/batch operations.
3. **JSON reliability**: Always enforce `response_format: { type: 'json_object' }` and validate the returned schema with `zod` before persisting. Provide a no-LLM fallback on parse failure.
4. **Rate limits**: OpenRouter has rate limits. Wrap `chatCompletion` in an exponential-backoff retry with jitter (max 3 retries).

---

*Report compiled by Architecture_Reviewer — Runway music discovery project.*