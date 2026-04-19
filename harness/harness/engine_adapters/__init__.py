"""Engine adapters — pluggable game engine integration."""
from .godot import GodotAdapter

ENGINES = {
    "godot": GodotAdapter,
}


def get_adapter(engine: str, dna, output_dir: str):
    """Get an engine adapter by name."""
    cls = ENGINES.get(engine)
    if cls:
        return cls(dna, output_dir)
    raise ValueError(f"Unknown engine: {engine}. Available: {list(ENGINES.keys())}")
