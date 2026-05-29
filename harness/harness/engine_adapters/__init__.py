"""Engine adapters — pluggable game engine integration.

Community adapters can be registered via entry_points or
by calling register_adapter() at runtime.

Install community adapters:
    pip install forgedna-unity-adapter
    pip install forgedna-bevy-adapter
"""

import importlib
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .base import EngineAdapter

from .base import EngineAdapter
from .godot import GodotAdapter

# ─── Built-in adapter registry ───────────────────────────────────────────────
_ADAPTERS: dict[str, type[EngineAdapter]] = {
    "godot": GodotAdapter,
}


def register_adapter(name: str, adapter_cls: type[EngineAdapter]) -> None:
    """Register a new engine adapter.

    Community adapters call this during their package __init__.py
    or via Python entry_points.
    """
    if not issubclass(adapter_cls, EngineAdapter):
        raise TypeError(f"{adapter_cls.__name__} must subclass EngineAdapter")
    _ADAPTERS[name.lower()] = adapter_cls


def get_adapter(engine: str, dna, output_dir: str) -> EngineAdapter:
    """Get an engine adapter by name.

    Raises ValueError with helpful message if adapter not found.
    Tries to load community adapters via entry_points before failing.
    """
    key = engine.lower()

    if key not in _ADAPTERS:
        # Try loading community adapters via entry_points
        _load_community_adapters()

    cls = _ADAPTERS.get(key)
    if cls is None:
        available = ", ".join(sorted(_ADAPTERS.keys()))
        raise ValueError(
            f"Unknown engine: '{engine}'. Available: [{available}]. "
            f"Install community adapters: pip install forgedna-{key}-adapter"
        )
    return cls(dna, output_dir)


def list_adapters() -> dict[str, dict]:
    """List all registered adapters with metadata."""
    _load_community_adapters()
    result = {}
    for name, cls in sorted(_ADAPTERS.items()):
        try:
            instance_meta = {
                "class": cls.__name__,
                "module": cls.__module__,
                "is_builtin": cls.__module__.startswith("harness."),
            }
            result[name] = instance_meta
        except Exception:
            result[name] = {"class": cls.__name__, "error": "failed to load"}
    return result


def _load_community_adapters() -> None:
    """Discover and load community adapters via Python entry_points."""
    try:
        from importlib.metadata import entry_points
        eps = entry_points()
        # Python 3.12+ returns a dict-like SelectableGroups
        forgedna_eps = eps.get("forgedna.adapters", []) if isinstance(eps, dict) else eps.select(group="forgedna.adapters")
        for ep in forgedna_eps:
            try:
                adapter_cls = ep.load()
                if issubclass(adapter_cls, EngineAdapter):
                    _ADAPTERS.setdefault(ep.name, adapter_cls)
            except Exception:
                pass  # Skip broken community adapters silently
    except Exception:
        pass
