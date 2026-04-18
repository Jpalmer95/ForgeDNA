"""Compare two game DNA files and show structural differences."""

import json
from pathlib import Path

import typer
from deepdiff import DeepDiff
from rich.console import Console
from rich.panel import Panel
from rich.tree import Tree

console = Console()


def _load_json(path: Path) -> dict:
    with open(path) as f:
        return json.load(f)


def compare_files(file1: str, file2: str) -> None:
    """Compare two DNA files and show differences."""
    p1 = Path(file1)
    p2 = Path(file2)

    if not p1.exists():
        console.print(f"[bold red]Error:[/] File not found: {file1}")
        raise typer.Exit(code=1)
    if not p2.exists():
        console.print(f"[bold red]Error:[/] File not found: {file2}")
        raise typer.Exit(code=1)

    data1 = _load_json(p1)
    data2 = _load_json(p2)

    # Get titles for display
    t1 = data1.get("meta", {}).get("title", p1.name)
    t2 = data2.get("meta", {}).get("title", p2.name)

    console.print(Panel(
        f"[cyan]{t1}[/]  vs  [cyan]{t2}[/]",
        title="forge diff",
        border_style="blue",
    ))

    # Use deepdiff for comparison
    diff = DeepDiff(data1, data2, ignore_order=True, verbose_level=2)

    if not diff:
        console.print("[bold green]Files are identical![/]")
        return

    # Dictionary Item Added
    if "dictionary_item_added" in diff:
        tree = Tree("[bold green]+ Added")
        for key in diff["dictionary_item_added"]:
            tree.add(f"[green]+ {key}")
        console.print(tree)

    # Dictionary Item Removed
    if "dictionary_item_removed" in diff:
        tree = Tree("[bold red]- Removed")
        for key in diff["dictionary_item_removed"]:
            tree.add(f"[red]- {key}")
        console.print(tree)

    # Values Changed
    if "values_changed" in diff:
        tree = Tree("[bold yellow]~ Changed")
        for key, change in diff["values_changed"].items():
            old = change.get("old_value", "?")
            new = change.get("new_value", "?")
            # Truncate long values
            old_str = str(old)[:80] + ("..." if len(str(old)) > 80 else "")
            new_str = str(new)[:80] + ("..." if len(str(new)) > 80 else "")
            tree.add(f"[yellow]~ {key}[/]\n    [dim]was:[/] [red]{old_str}[/]\n    [dim]now:[/] [green]{new_str}[/]")
        console.print(tree)

    # Type Changes
    if "type_changes" in diff:
        tree = Tree("[bold magenta]* Type Changed")
        for key, change in diff["type_changes"].items():
            old_type = change.get("old_type", "?")
            new_type = change.get("new_type", "?")
            tree.add(f"[magenta]* {key}[/]: {old_type} → {new_type}")
        console.print(tree)

    # List changes
    if "iterable_item_added" in diff:
        tree = Tree("[bold green]+ List Items Added")
        for key, val in diff["iterable_item_added"].items():
            val_str = str(val)[:60] + ("..." if len(str(val)) > 60 else "")
            tree.add(f"[green]+ {key}: {val_str}[/]")
        console.print(tree)

    if "iterable_item_removed" in diff:
        tree = Tree("[bold red]- List Items Removed")
        for key, val in diff["iterable_item_removed"].items():
            val_str = str(val)[:60] + ("..." if len(str(val)) > 60 else "")
            tree.add(f"[red]- {key}: {val_str}[/]")
        console.print(tree)

    # Summary
    total_changes = sum(len(v) for v in diff.values())
    console.print(f"\n  [dim]Total changes: {total_changes}[/]")
