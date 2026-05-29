"""Abstract base class for engine adapters.

Community contributors: implement this interface to add support
for a new game engine (Unity, Unreal, Bevy, FNA, etc).

See docs/creating-engine-adapters.md for a complete guide.
"""

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any


class EngineAdapter(ABC):
    """Engine-agnostic interface for generating playable game projects.

    All adapters receive the same inputs (parsed GameDNA + generated
    asset/code outputs) and must produce a complete, buildable engine
    project on disk.
    """

    def __init__(self, dna: Any, output_dir: str):
        self.dna = dna
        self.output_dir = Path(output_dir)

    @abstractmethod
    def generate_project(self, outputs: dict[str, Any]) -> dict[str, Any]:
        """Assemble all generated outputs into a complete engine project.

        Args:
            outputs: Dict mapping task_id -> output artifacts from the
                     build pipeline. Each value is a dict with at least
                     'output_path' and 'agent_type'.

        Returns:
            Dict with:
                project_path: str — root path of the generated project
                files_created: list[str] — all files written
                engine_version: str — engine version used
                export_targets: list[str] — platforms this project can export to
        """
        ...

    @abstractmethod
    def get_supported_features(self) -> list[str]:
        """Return the list of GameDNA features this adapter supports.

        Example: ['movement', 'combat', 'crafting', 'day_night', 'weather']
        The hub/harness uses this to show a compatibility matrix.
        """
        ...

    @abstractmethod
    def get_export_targets(self) -> list[str]:
        """Return platforms this engine can export to.

        Example: ['pc', 'web', 'android', 'ios']
        """
        ...

    def get_engine_name(self) -> str:
        """Human-readable engine name. Override for custom display."""
        return self.__class__.__name__.replace("Adapter", "").lower()

    def get_engine_version(self) -> str:
        """Engine version string. Override to report actual version."""
        return "unknown"

    def get_compatibility_score(self, dna: Any) -> dict[str, bool]:
        """Check which DNA features are supported vs unsupported.

        Returns dict mapping feature_name -> is_supported.
        Default implementation checks against get_supported_features().
        """
        supported = set(self.get_supported_features())
        all_features = {
            "movement", "combat", "crafting", "progression", "economy",
            "day_night", "weather", "quests", "npcs", "enemies",
            "items", "inventory", "dialogue", "skill_trees", "save_system",
        }
        return {f: f in supported for f in all_features}
