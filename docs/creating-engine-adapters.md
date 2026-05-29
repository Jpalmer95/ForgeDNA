# Creating Engine Adapters

ForgeDNA is engine-agnostic. The `EngineAdapter` interface lets community
contributors add support for any game engine.

## Quick Start

```python
from harness.harness.engine_adapters.base import EngineAdapter

class MyEngineAdapter(EngineAdapter):

    def generate_project(self, outputs):
        # Write engine-specific project files using self.dna and outputs
        ...
        return {
            "project_path": str(self.output_dir / "my_project"),
            "files_created": files,
            "engine_version": "1.0",
            "export_targets": ["pc", "web"],
        }

    def get_supported_features(self):
        return ["movement", "combat", "quests"]

    def get_export_targets(self):
        return ["pc", "web"]
```

## Publishing as a Package

Create a Python package with an entry point:

```toml
# pyproject.toml
[project.entry-points."forgedna.adapters"]
unity = "forgedna_unity:UnityAdapter"
```

Once installed, ForgeDNA discovers it automatically:

```bash
pip install forgedna-unity-adapter
forgedna-harness build-full my_game.json --engine unity
```

## Interface Contract

| Method | Returns | Purpose |
|--------|---------|---------|
| `generate_project(outputs)` | `dict` | Assemble all agent outputs into a buildable project |
| `get_supported_features()` | `list[str]` | Which DNA features this adapter handles |
| `get_export_targets()` | `list[str]` | Which platforms this engine can export to |
| `get_engine_name()` | `str` | Display name (auto-derived from class name) |
| `get_engine_version()` | `str` | Engine version string |

## Feature Names

Standard feature names (use these for compatibility matrix):

- movement, combat, crafting, progression, economy
- day_night, weather, quests, npcs, enemies
- items, inventory, dialogue, skill_trees, save_system
