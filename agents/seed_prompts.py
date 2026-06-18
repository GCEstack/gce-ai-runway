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
            "created_by": "system"
        },
        {
            "name": "beatport_top",
            "label": "",
            "genre": "melodic house",
            "energy": "",
            "bpm_min": 0,
            "bpm_max": 0,
            "timeframe": "last_7_days",
            "exclude_playlist": "",
            "limit": 50,
            "description": "Top trending melodic house from Beatport charts — curated, broad selection",
            "created_by": "system"
        }
    ]

    for p in prompts:
        try:
            result = client.create_prompt(**p)
            print(f"✅ Created prompt: {p['name']}")
        except Exception as e:
            # Might already exist
            print(f"⚠️ {p['name']}: {e}")

    print("\nDone. Verify at https://runway-lac-ten.vercel.app/prompts")


if __name__ == "__main__":
    main()
