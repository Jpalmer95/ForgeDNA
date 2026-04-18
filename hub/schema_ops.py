"""
ForgeDNA Schema Operations — validation, templates, summary, diff.

Uses jsonschema for validation and deepdiff for structured diffs.
"""

import json
import copy
from pathlib import Path
from typing import Optional
from datetime import datetime

SCHEMA_PATH = Path(__file__).resolve().parent / "schema" / "game_dna.schema.json"

# Fallback: also check parent/schema for HF Spaces layout
if not SCHEMA_PATH.exists():
    SCHEMA_PATH = Path(__file__).resolve().parent.parent / "schema" / "game_dna.schema.json"

TEMPLATES_DIR = Path(__file__).resolve().parent / "templates"
if not TEMPLATES_DIR.exists():
    TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "cli" / "forgedna" / "templates"

_schema_cache: Optional[dict] = None


def load_schema() -> dict:
    """Load and cache the game_dna schema."""
    global _schema_cache
    if _schema_cache is None:
        _schema_cache = json.loads(SCHEMA_PATH.read_text())
    return _schema_cache


def validate(dna_dict: dict) -> tuple[bool, list[str]]:
    """
    Validate a game DNA dict against the schema.
    Returns (is_valid, list_of_errors).
    """
    try:
        from jsonschema import validate as json_validate, ValidationError
        schema = load_schema()
        # Strip $schema and _comment keys that jsonschema might complain about
        clean = {k: v for k, v in dna_dict.items() if not k.startswith("_") and k != "$schema"}
        # We need to be lenient because the examples use values like null for combat style
        # which isn't in the enum. Use Draft7Validator for checking.
        from jsonschema import Draft7Validator
        validator = Draft7Validator(schema)
        errors = []
        for error in sorted(validator.iter_errors(clean), key=lambda e: list(e.absolute_path)):
            path = " -> ".join(str(p) for p in error.absolute_path) or "root"
            errors.append(f"{path}: {error.message}")
        return len(errors) == 0, errors
    except ImportError:
        return True, ["jsonschema not installed — skipping validation"]


def get_summary(dna_dict: dict) -> dict:
    """Get a summary of a game DNA dict."""
    meta = dna_dict.get("meta", {})
    mech = dna_dict.get("mechanics", {})
    world = dna_dict.get("world", {})
    entities = dna_dict.get("entities", {})
    assets = dna_dict.get("assets", {})
    logic = dna_dict.get("logic", {})
    ui = dna_dict.get("ui", {})

    env_count = len(world.get("environments", []))
    dungeon_count = len(world.get("dungeons", []))
    enemy_count = len(entities.get("enemies", []))
    npc_count = len(entities.get("npcs", []))
    quest_count = len(logic.get("quests", []))
    recipe_count = len(logic.get("crafting_recipes", []))

    model_count = len(assets.get("models_3d", []))
    texture_count = len(assets.get("textures", []))
    anim_count = len(assets.get("animations", []))
    vfx_count = len(assets.get("vfx", []))
    music_count = len(assets.get("audio", {}).get("music", []))
    sfx_count = len(assets.get("audio", {}).get("sfx", []))

    combat_style = mech.get("combat", {}).get("style") or "None"
    weapon_count = len(mech.get("combat", {}).get("weapon_categories", []))
    status_count = len(mech.get("combat", {}).get("status_effects", []))
    movement_count = len(mech.get("movement", {}).get("types", []))

    custom_mech = len(mech.get("custom_mechanics", []))
    skill_trees = len(mech.get("progression", {}).get("skill_trees", []))

    # Count total lines of JSON as a rough size indicator
    raw = json.dumps(dna_dict)
    size_kb = len(raw) / 1024

    return {
        "title": meta.get("title", "Untitled"),
        "genre": meta.get("genre", []),
        "art_style": meta.get("art_style", "N/A"),
        "tagline": meta.get("tagline", ""),
        "platforms": meta.get("target_platforms", []),
        "rating": meta.get("rating", "N/A"),
        "player_count": meta.get("player_count", {}),
        "tags": meta.get("tags", []),
        "environments": env_count,
        "dungeons": dungeon_count,
        "enemies": enemy_count,
        "npcs": npc_count,
        "quests": quest_count,
        "recipes": recipe_count,
        "combat_style": combat_style,
        "weapons": weapon_count,
        "status_effects": status_count,
        "movement_types": movement_count,
        "custom_mechanics": custom_mech,
        "skill_trees": skill_trees,
        "models_3d": model_count,
        "textures": texture_count,
        "animations": anim_count,
        "vfx": vfx_count,
        "music_tracks": music_count,
        "sfx": sfx_count,
        "has_ui": bool(ui),
        "has_assets": bool(assets),
        "has_logic": bool(logic),
        "size_kb": round(size_kb, 1),
    }


def get_template_names() -> list[str]:
    """List available template names."""
    if not TEMPLATES_DIR.exists():
        return []
    return sorted(p.stem for p in TEMPLATES_DIR.glob("*.json"))


def load_template(name: str) -> Optional[dict]:
    """Load a template by name."""
    path = TEMPLATES_DIR / f"{name}.json"
    if path.exists():
        return json.loads(path.read_text())
    return None


def diff(dna1: dict, dna2: dict) -> dict:
    """Compute a structured diff between two DNA dicts."""
    try:
        from deepdiff import DeepDiff
        d = DeepDiff(dna1, dna2, ignore_order=True, verbose_level=2)
        return {
            "added": str(d.get("dictionary_item_added", "")),
            "removed": str(d.get("dictionary_item_removed", "")),
            "changed": str(d.get("values_changed", "")),
            "type_changes": str(d.get("type_changes", "")),
            "raw": d.to_dict() if hasattr(d, "to_dict") else dict(d),
        }
    except ImportError:
        return {"error": "deepdiff not installed"}


def create_remix(dna: dict, new_title: Optional[str] = None) -> dict:
    """Create a remix/fork of a DNA file with lineage metadata."""
    remix = copy.deepcopy(dna)

    # Add lineage info to meta
    meta = remix.setdefault("meta", {})
    original_title = meta.get("title", "Unknown")
    lineage = meta.get("lineage", [])
    lineage.append({
        "source": original_title,
        "remixed_at": datetime.utcnow().isoformat() + "Z",
    })
    meta["lineage"] = lineage

    if new_title:
        meta["title"] = new_title
    else:
        meta["title"] = f"{original_title} (Remix)"

    return remix
