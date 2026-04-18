"""Parse and validate GameDNA JSON files."""
import json
from pathlib import Path
from typing import Any


class GameDNA:
    """Parsed game DNA document."""

    def __init__(self, data: dict[str, Any], source_path: str = "<memory>"):
        self.data = data
        self.source_path = source_path
        self.meta = data.get("meta", {})
        self.mechanics = data.get("mechanics", {})
        self.world = data.get("world", {})
        self.entities = data.get("entities", {})
        self.assets = data.get("assets", {})
        self.logic = data.get("logic", {})
        self.ui = data.get("ui", {})

    @property
    def title(self) -> str:
        return self.meta.get("title", "Untitled Game")

    @property
    def genre(self) -> list[str]:
        return self.meta.get("genre", [])

    @property
    def art_style(self) -> str:
        return self.meta.get("art_style", "unknown")

    def environments(self) -> list[dict]:
        return self.world.get("environments", [])

    def dungeons(self) -> list[dict]:
        return self.world.get("dungeons", [])

    def enemies(self) -> list[dict]:
        return self.entities.get("enemies", [])

    def quests(self) -> list[dict]:
        return self.logic.get("quests", [])

    def models_3d(self) -> list[dict]:
        return self.assets.get("models_3d", [])

    def textures(self) -> list[dict]:
        return self.assets.get("textures", [])

    def animations(self) -> list[dict]:
        return self.assets.get("animations", [])

    def audio_music(self) -> list[dict]:
        return self.assets.get("audio", {}).get("music", [])

    def audio_sfx(self) -> list[dict]:
        return self.assets.get("audio", {}).get("sfx", [])

    def audio_ambient(self) -> list[dict]:
        return self.assets.get("audio", {}).get("ambient", [])

    def audio_voice(self) -> list[dict]:
        return self.assets.get("audio", {}).get("voice", [])

    def vfx(self) -> list[dict]:
        return self.assets.get("vfx", [])

    def skill_trees(self) -> list[dict]:
        return self.logic.get("skill_trees", [])

    def crafting_recipes(self) -> list[dict]:
        return self.logic.get("crafting_recipes", [])

    def world_events(self) -> list[dict]:
        return self.logic.get("world_events", [])

    def hud_elements(self) -> list[dict]:
        return self.ui.get("hud_elements", [])

    def menus(self) -> list[dict]:
        return self.ui.get("menus", [])

    def summary(self) -> dict[str, Any]:
        """Return a summary of the game DNA."""
        return {
            "title": self.title,
            "genre": self.genre,
            "art_style": self.art_style,
            "platforms": self.meta.get("target_platforms", []),
            "environments": len(self.environments()),
            "dungeons": len(self.dungeons()),
            "enemies": len(self.enemies()),
            "quests": len(self.quests()),
            "models_3d": len(self.models_3d()),
            "textures": len(self.textures()),
            "animations": len(self.animations()),
            "music_tracks": len(self.audio_music()),
            "sfx": len(self.audio_sfx()),
            "ambient_sounds": len(self.audio_ambient()),
            "voice_characters": len(self.audio_voice()),
            "vfx": len(self.vfx()),
            "skill_trees": len(self.skill_trees()),
            "crafting_recipes": len(self.crafting_recipes()),
            "world_events": len(self.world_events()),
            "hud_elements": len(self.hud_elements()),
            "menus": len(self.menus()),
        }


def load_dna(path: str | Path) -> GameDNA:
    """Load a game DNA file from disk."""
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"GameDNA file not found: {path}")
    with open(path) as f:
        data = json.load(f)
    return GameDNA(data, source_path=str(path))


def load_dna_from_dict(data: dict, name: str = "<memory>") -> GameDNA:
    """Create a GameDNA from a dict."""
    return GameDNA(data, source_path=name)
