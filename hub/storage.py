"""
ForgeDNA Hub Storage — HF Hub integration with local fallback.

Uses huggingface_hub to list/download/upload game DNA files from a HF dataset repo.
Falls back to local examples/ directory when no HF token is available.
"""

import os
import json
import glob
from pathlib import Path
from typing import Optional

FORGEDNA_ROOT = Path(__file__).resolve().parent.parent
LOCAL_EXAMPLES_DIR = FORGEDNA_ROOT / "examples"
LOCAL_TEMPLATES_DIR = FORGEDNA_ROOT / "cli" / "forgedna" / "templates"
DEFAULT_HF_REPO = os.environ.get("FORGEDNA_HUB_REPO", "forgedna/game-dna")
HF_TOKEN = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")


def _hf_available() -> bool:
    """Check if HF Hub integration is usable."""
    try:
        from huggingface_hub import HfApi
        return HF_TOKEN is not None
    except ImportError:
        return False


def list_dna_files() -> list[dict]:
    """
    List all game DNA files available.
    Returns list of dicts with keys: filename, title, genre, art_style, tagline, source.
    """
    results = []

    # Always include local examples
    if LOCAL_EXAMPLES_DIR.exists():
        for fp in sorted(LOCAL_EXAMPLES_DIR.glob("*.json")):
            try:
                data = json.loads(fp.read_text())
                meta = data.get("meta", {})
                results.append({
                    "filename": fp.name,
                    "path": str(fp),
                    "title": meta.get("title", fp.stem),
                    "genre": meta.get("genre", []),
                    "art_style": meta.get("art_style", "unknown"),
                    "tagline": meta.get("tagline", ""),
                    "description": meta.get("description", ""),
                    "tags": meta.get("tags", []),
                    "complexity": _infer_complexity(data),
                    "source": "local",
                })
            except (json.JSONDecodeError, KeyError):
                continue

    # Try HF Hub if available
    if _hf_available():
        try:
            from huggingface_hub import HfApi
            api = HfApi(token=HF_TOKEN)
            files = api.list_repo_files(DEFAULT_HF_REPO, repo_type="dataset")
            for f in files:
                if f.endswith(".json") and not f.startswith("."):
                    try:
                        content = api.hf_hub_download(
                            DEFAULT_HF_REPO, f, repo_type="dataset"
                        )
                        with open(content) as fh:
                            data = json.load(fh)
                        meta = data.get("meta", {})
                        # Don't duplicate if local version exists
                        if not any(r["filename"] == os.path.basename(f) for r in results):
                            results.append({
                                "filename": os.path.basename(f),
                                "path": f"hf://{DEFAULT_HF_REPO}/{f}",
                                "title": meta.get("title", Path(f).stem),
                                "genre": meta.get("genre", []),
                                "art_style": meta.get("art_style", "unknown"),
                                "tagline": meta.get("tagline", ""),
                                "description": meta.get("description", ""),
                                "tags": meta.get("tags", []),
                                "complexity": _infer_complexity(data),
                                "source": "huggingface",
                            })
                    except Exception:
                        continue
        except Exception:
            pass

    return results


def load_dna(filename_or_path: str) -> Optional[dict]:
    """Load a game DNA file by filename (local) or HF path."""
    # Try local first
    local_path = LOCAL_EXAMPLES_DIR / filename_or_path
    if local_path.exists():
        return json.loads(local_path.read_text())

    # Try as absolute path
    if os.path.isfile(filename_or_path):
        return json.loads(Path(filename_or_path).read_text())

    # Try HF Hub
    if _hf_available() and filename_or_path.startswith("hf://"):
        try:
            from huggingface_hub import hf_hub_download
            parts = filename_or_path.replace("hf://", "").split("/", 1)
            repo_id = parts[0]
            subpath = parts[1] if len(parts) > 1 else ""
            downloaded = hf_hub_download(repo_id, subpath, repo_type="dataset")
            return json.loads(Path(downloaded).read_text())
        except Exception:
            pass

    # Try HF by filename
    if _hf_available():
        try:
            from huggingface_hub import hf_hub_download
            downloaded = hf_hub_download(DEFAULT_HF_REPO, filename_or_path, repo_type="dataset")
            return json.loads(Path(downloaded).read_text())
        except Exception:
            pass

    return None


def upload_dna(dna_dict: dict, filename: str) -> bool:
    """Upload a game DNA file. Tries HF Hub, falls back to local save."""
    # Try HF Hub first
    if _hf_available():
        try:
            from huggingface_hub import HfApi
            import tempfile
            api = HfApi(token=HF_TOKEN)
            with tempfile.NamedTemporaryFile(
                mode="w", suffix=".json", delete=False
            ) as tmp:
                json.dump(dna_dict, tmp, indent=2)
                tmp_path = tmp.name
            api.upload_file(
                path_or_fileobj=tmp_path,
                path_in_repo=filename,
                repo_id=DEFAULT_HF_REPO,
                repo_type="dataset",
            )
            os.unlink(tmp_path)
            return True
        except Exception:
            pass

    # Fallback: save locally
    out_path = LOCAL_EXAMPLES_DIR / filename
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(dna_dict, indent=2))
    return True


def _infer_complexity(dna: dict) -> str:
    """Infer game complexity from DNA content."""
    score = 0
    # Check mechanics depth
    mech = dna.get("mechanics", {})
    if mech.get("custom_mechanics"):
        score += len(mech["custom_mechanics"])
    if mech.get("crafting", {}).get("enabled"):
        score += 2
    if mech.get("combat", {}).get("weapon_categories"):
        score += len(mech["combat"]["weapon_categories"])
    if mech.get("progression", {}).get("skill_trees"):
        score += len(mech["progression"]["skill_trees"])

    # Check world depth
    world = dna.get("world", {})
    envs = world.get("environments", [])
    score += len(envs)
    if world.get("dungeons"):
        score += len(world["dungeons"]) * 2
    if world.get("procedural_generation", {}).get("enabled"):
        score += 2

    # Check assets
    assets = dna.get("assets", {})
    for key in ("models_3d", "textures", "animations", "vfx"):
        score += len(assets.get(key, []))

    # Check logic
    logic = dna.get("logic", {})
    score += len(logic.get("quests", []))
    score += len(logic.get("crafting_recipes", []))

    if score < 10:
        return "minimal"
    elif score < 25:
        return "simple"
    elif score < 50:
        return "moderate"
    else:
        return "complex"


def export_markdown(dna: dict) -> str:
    """Export a game DNA dict as a markdown summary."""
    meta = dna.get("meta", {})
    lines = [
        f"# {meta.get('title', 'Untitled Game')}",
        "",
        f"**{meta.get('tagline', '')}**",
        "",
        f"Genre: {', '.join(meta.get('genre', []))}  ",
        f"Art Style: {meta.get('art_style', 'N/A')}  ",
        f"Platforms: {', '.join(meta.get('target_platforms', []))}  ",
        f"Rating: {meta.get('rating', 'N/A')}  ",
        "",
        "## Description",
        "",
        meta.get("description", "No description provided."),
        "",
    ]

    # Mechanics
    mech = dna.get("mechanics", {})
    lines.append("## Mechanics")
    if mech.get("movement"):
        lines.append(f"**Movement:** {', '.join(mech['movement'].get('types', []))}")
    if mech.get("combat", {}).get("style"):
        lines.append(f"**Combat Style:** {mech['combat']['style']}")
    if mech.get("crafting", {}).get("enabled"):
        lines.append(f"**Crafting:** {', '.join(mech['crafting'].get('professions', []))}")
    if mech.get("progression"):
        lines.append(f"**Progression:** {mech['progression'].get('type', 'N/A')}")
    cm = mech.get("custom_mechanics", [])
    if cm:
        lines.append("")
        lines.append("### Custom Mechanics")
        for c in cm:
            lines.append(f"- **{c['name']}**: {c['description']}")
    lines.append("")

    # World
    world = dna.get("world", {})
    lines.append("## World")
    lines.append(f"Scale: {world.get('scale', 'N/A')} | Structure: {world.get('structure', 'N/A')}")
    for env in world.get("environments", []):
        lines.append(f"### {env.get('name', 'Unnamed')}")
        lines.append(f"Type: {env.get('type', 'N/A')}")
        lines.append(env.get("visual_description", ""))
        lines.append("")

    # Entities
    entities = dna.get("entities", {})
    lines.append("## Entities")
    if entities.get("player"):
        lines.append("### Player")
        lines.append(entities["player"].get("visual_description", ""))
    if entities.get("enemies"):
        lines.append("### Enemies")
        for e in entities["enemies"][:10]:
            lines.append(f"- **{e.get('name', '?')}** ({e.get('type', '?')}): {e.get('description', '')}")
    lines.append("")

    # UI
    ui = dna.get("ui", {})
    if ui.get("style"):
        lines.append("## UI")
        lines.append(ui["style"])

    return "\n".join(lines)
