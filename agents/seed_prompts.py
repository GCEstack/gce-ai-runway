#!/usr/bin/env python3
"""
Seed default prompts into Supabase.
Run once: python seed_prompts.py
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from runway_client import RunwayClient


def main():
    client = RunwayClient()

    # All prompts have a genre that works for BOTH Tidal and Beatport search.
    # preferred_service is a UI hint — the prompt will work on any service but
    # defaults to the one where it was originally designed.
    prompts = [
        {
            "name": "friday_warmup",
            "label": "",
            "genre": "techno",
            "energy": "medium",
            "bpm_min": 125,
            "bpm_max": 128,
            "timeframe": "last_14_days",
            "exclude_playlist": "Played Out",
            "limit": 30,
            "description": "Melodic, building techno for a Friday night warmup — groovy, not peak-time",
            "preferred_service": "beatport",
            "created_by": "system"
        },
        {
            "name": "warehouse_peak",
            "label": "Drumcode",
            "genre": "techno",
            "energy": "high",
            "bpm_min": 130,
            "bpm_max": 135,
            "timeframe": "last_30_days",
            "exclude_playlist": "",
            "limit": 25,
            "description": "Peak-time warehouse weapons — raw, driving, high-energy techno",
            "preferred_service": "beatport",
            "created_by": "system"
        },
        {
            "name": "sunday_deep",
            "label": "",
            "genre": "deep house",
            "energy": "low",
            "bpm_min": 120,
            "bpm_max": 124,
            "timeframe": "last_7_days",
            "exclude_playlist": "",
            "limit": 20,
            "description": "Sunday morning deep cuts — warm, organic, low-energy house",
            "preferred_service": "tidal",
            "created_by": "system"
        },
        {
            "name": "melodic_vibes",
            "label": "",
            "genre": "melodic house",
            "energy": "medium",
            "bpm_min": 122,
            "bpm_max": 126,
            "timeframe": "last_7_days",
            "exclude_playlist": "",
            "limit": 30,
            "description": "Melodic house selections — emotional, progressive, dancefloor-friendly",
            "preferred_service": "tidal",
            "created_by": "system"
        },
        {
            "name": "tech_house_groove",
            "label": "",
            "genre": "tech house",
            "energy": "medium",
            "bpm_min": 124,
            "bpm_max": 128,
            "timeframe": "last_14_days",
            "exclude_playlist": "",
            "limit": 25,
            "description": "Rolling basslines, vocal chops, and groovy tech house energy",
            "preferred_service": "beatport",
            "created_by": "system"
        },
        {
            "name": "acid_experiment",
            "label": "",
            "genre": "acid",
            "energy": "high",
            "bpm_min": 128,
            "bpm_max": 132,
            "timeframe": "last_30_days",
            "exclude_playlist": "",
            "limit": 20,
            "description": "Acid lines, 303 squelch, and raw electronic textures",
            "preferred_service": "beatport",
            "created_by": "system"
        },
        {
            "name": "trance_classics",
            "label": "",
            "genre": "trance",
            "energy": "high",
            "bpm_min": 130,
            "bpm_max": 138,
            "timeframe": "last_30_days",
            "exclude_playlist": "",
            "limit": 30,
            "description": "Uplifting and progressive trance — big melodies, emotional builds",
            "preferred_service": "tidal",
            "created_by": "system"
        },
        {
            "name": "drum_bass_rollers",
            "label": "",
            "genre": "dnb",
            "energy": "high",
            "bpm_min": 172,
            "bpm_max": 178,
            "timeframe": "last_14_days",
            "exclude_playlist": "",
            "limit": 25,
            "description": "Drum & bass rollers — heavy bass, fast breaks, dancefloor pressure",
            "preferred_service": "beatport",
            "created_by": "system"
        },
        {
            "name": "beatport_top",
            "label": "",
            "genre": "melodic house",
            "energy": "",
            "bpm_min": None,
            "bpm_max": None,
            "timeframe": "last_7_days",
            "exclude_playlist": "",
            "limit": 50,
            "description": "Top trending melodic house from Beatport charts — curated, broad selection. Best on Beatport.",
            "preferred_service": "beatport",
            "created_by": "system"
        }
    ]

    for p in prompts:
        try:
            # Upsert by name (update if exists, create if not)
            result = client._request(
                "POST",
                "prompts",
                data=p,
                params={"on_conflict": "name"}
            )
            print(f"✅ Upserted prompt: {p['name']}")
        except Exception as e:
            print(f"⚠️ {p['name']}: {e}")

    print("\nDone. Verify at https://runway-lac-ten.vercel.app/prompts")


if __name__ == "__main__":
    main()
