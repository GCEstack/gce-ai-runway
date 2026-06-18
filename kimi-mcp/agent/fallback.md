# Unified Music Agent — Fallback Logic

When a track is unavailable on the primary service, follow this fallback procedure.

## Fallback Rules

### Rule 1: Primary service returns no results

```
if primary_results.length == 0:
    query fallback_service with same parameters
```

### Rule 2: Track unavailable on primary but available on fallback

```
for track in primary_results:
    if track.missing_on_primary:
        fallback_track = search_fallback(track.title, track.artist)
        if fallback_track:
            track.fallback_service_id = fallback_track.id
            track.fallback_url = fallback_track.url
            track.source = "both"
```

### Rule 3: Track unavailable on both services

```
if not primary_track and not fallback_track:
    mark track as unavailable
    log: { title, artist, reason: "not_found_on_either_service" }
    continue
```

## Matching Strategy

1. **ISRC match** (highest confidence)
2. **Title + Artist exact match**
3. **Title + primary artist only**
4. **Fuzzy title match** with artist overlap

## Output Annotation

Each returned track must include:

```json
{
  "source": "tidal | spotify | both",
  "primary_available": true | false,
  "fallback_available": true | false,
  "match_confidence": "high | medium | low",
  "match_method": "isrc | exact | fuzzy"
}
```

## Example

Primary service: Tidal  
Track: "Unknown Artist - Lost Track"  
Tidal result: not found  
Spotify fallback: found by title + artist  
Output: track with `source: "spotify"`, `fallback_available: true`, `match_confidence: "medium"`.
