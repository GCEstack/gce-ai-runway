#!/usr/bin/env python3
"""
Update existing prompts in Supabase to ensure genre is set and add preferred_service.
Run this to fix prompts that have null/empty genre fields.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from runway_client import RunwayClient


def main():
    client = RunwayClient()

    # Prompts that need genre set (if null/empty in DB)
    GENRE_FIXES = {
        "beatport_top": "melodic house",
    }

    # Fetch all existing prompts
    try:
        prompts = client._request("GET", "prompts", params={"select": "*"})
    except Exception as e:
        print(f"❌ Failed to fetch prompts: {e}")
        return

    print(f"Found {len(prompts)} prompts in database\n")

    for p in prompts:
        name = p.get("name", "")
        current_genre = p.get("genre", "")
        current_label = p.get("label", "")
        current_bpm_min = p.get("bpm_min", 0)
        current_bpm_max = p.get("bpm_max", 0)
        prompt_id = p.get("id", "")

        updates = {}

        # Fix null/empty genre
        if not current_genre and name in GENRE_FIXES:
            updates["genre"] = GENRE_FIXES[name]
            print(f"  📝 {name}: genre '{current_genre}' → '{GENRE_FIXES[name]}'")

        # Fix 0 BPM to null (so query builders skip it properly)
        if current_bpm_min == 0 and current_bpm_max == 0:
            updates["bpm_min"] = None
            updates["bpm_max"] = None
            print(f"  📝 {name}: bpm 0-0 → null (skips BPM in queries)")

        if updates:
            try:
                client._request(
                    "PATCH",
                    f"prompts?id=eq.{prompt_id}",
                    data=updates
                )
                print(f"  ✅ Updated {name}\n")
            except Exception as e:
                print(f"  ❌ Failed to update {name}: {e}\n")
        else:
            print(f"  ✓ {name}: OK (genre='{current_genre}', bpm={current_bpm_min}-{current_bpm_max})\n")

    print("Done. Re-run seed_prompts.py if you want to add new prompts.")


if __name__ == "__main__":
    main()
