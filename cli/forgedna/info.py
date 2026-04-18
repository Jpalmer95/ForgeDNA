"""Show summary statistics about a game DNA file."""

import json
from pathlib import Path

import typer
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()


def _safe_len(obj, key, default=0) -> int:
    """Safely get the length of a nested list."""
    val = obj.get(key) if isinstance(obj, dict) else None
    if isinstance(val, list):
        return len(val)
    return default


def show_info(file_path: str) -> None:
    """Display summary info about a game DNA file."""
    path = Path(file_path)

    if not path.exists():
        console.print(f"[bold red]Error:[/] File not found: {file_path}")
        raise typer.Exit(code=1)

    try:
        with open(path) as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        console.print(f"[bold red]Error:[/] Invalid JSON: {e}")
        raise typer.Exit(code=1)

    meta = data.get("meta", {})
    world = data.get("world", {})
    entities = data.get("entities", {})
    logic = data.get("logic", {})

    # Basic info
    title = meta.get("title", "Untitled")
    genre = meta.get("genre", [])
    art_style = meta.get("art_style", "unknown")

    # Counts
    platform_count = len(meta.get("target_platforms", []))
    env_count = len(world.get("environments", []))
    dungeon_count = len(world.get("dungeons", []))
    enemy_count = len(entities.get("enemies", []))
    quest_count = len(logic.get("quests", []))

    # File size
    file_size = path.stat().st_size
    if file_size < 1024:
        size_str = f"{file_size} B"
    elif file_size < 1024 * 1024:
        size_str = f"{file_size / 1024:.1f} KB"
    else:
        size_str = f"{file_size / (1024 * 1024):.1f} MB"

    # Display
    table = Table(title=f"Game DNA Info: {title}", show_lines=True, title_style="bold cyan")
    table.add_column("Property", style="bold yellow", no_wrap=True)
    table.add_column("Value", style="green")

    table.add_row("Title", title)
    table.add_row("Genre", ", ".join(genre) if genre else "Not set")
    table.add_row("Art Style", art_style)
    table.add_row("Target Platforms", str(platform_count))
    table.add_row("Environments", str(env_count))
    table.add_row("Dungeons", str(dungeon_count))
    table.add_row("Enemies", str(enemy_count))
    table.add_row("Quests", str(quest_count))
    table.add_row("File Size", size_str)

    console.print(table)

    # Sub-details
    if world.get("environments"):
        env_names = [e.get("name", "?") for e in world["environments"]]
        console.print(f"\n  [dim]Environments:[/] {', '.join(env_names)}")

    if world.get("dungeons"):
        dg_names = [d.get("name", "?") for d in world["dungeons"]]
        console.print(f"  [dim]Dungeons:[/]     {', '.join(dg_names)}")
