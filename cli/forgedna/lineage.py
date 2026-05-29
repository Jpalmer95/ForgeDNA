"""Visualize DNA lineage ancestry tree."""

import json
from pathlib import Path

import typer
from rich.console import Console
from rich.panel import Panel
from rich.tree import Tree

console = Console()


def show_lineage(file_path: str, verbose: bool = False) -> None:
    """Show the ancestry tree of a DNA file."""
    src = Path(file_path)

    if not src.exists():
        console.print(f"[bold red]Error:[/] File not found: {file_path}")
        raise typer.Exit(code=1)

    try:
        with open(src) as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        console.print(f"[bold red]Error:[/] Invalid JSON: {e}")
        raise typer.Exit(code=1)

    meta = data.get("meta", {})
    lineage = meta.get("lineage")

    if not lineage:
        console.print(Panel(
            f"[bold]{meta.get('title', src.stem)}[/]\n"
            f"DNA ID: [cyan]{src.stem}[/]\n\n"
            f"[dim]No lineage data found. This appears to be an original DNA.[/]\n"
            f"[dim]Run 'forgedna remix' to create a remixed copy with lineage tracking.[/]",
            title="Lineage",
            border_style="blue",
        ))
        return  # ← FIX: add return here

    # Build the tree
    gen = lineage.get("generation", 0)
    dna_id = lineage.get("dna_id", "unknown")
    title = meta.get("title", src.stem)
    author = meta.get("author", "unknown")

    tree = Tree(
        f"[bold]Lineage: {title}[/] (gen {gen})",
        guide_style="bright_blue",
    )

    # Build ancestry from oldest to newest
    ancestors = lineage.get("ancestors", [])
    ancestors_sorted = sorted(ancestors, key=lambda a: a.get("generation", 0))

    # Create the tree from root to current
    current_node = tree
    for ancestor in ancestors_sorted:
        a_title = ancestor.get("title", "?")
        a_author = ancestor.get("author", "unknown")
        a_gen = ancestor.get("generation", 0)
        a_id = ancestor.get("dna_id", "?")[:8]

        label = f"[cyan]{a_title}[/] [dim](gen {a_gen}, {a_id}... by {a_author})[/]"
        current_node = current_node.add(label)

    # Add current DNA as leaf
    current_node.add(
        f"[bold green]★ {title}[/] [dim](gen {gen}, {dna_id[:8]}... by {author})[/]"
    )

    console.print()
    console.print(tree)

    # Verbose mode shows extra details
    if verbose:
        console.print()
        console.print(Panel(
            f"DNA ID:     [cyan]{dna_id}[/]\n"
            f"Parent ID:  [dim]{lineage.get('parent_id', 'none')}[/]\n"
            f"Original:   [dim]{lineage.get('original_id', 'self')}[/]\n"
            f"Generation: {gen}\n"
            f"Remixed by: {lineage.get('remixed_by', 'unknown')}\n"
            f"Remixed at: {lineage.get('remixed_at', 'unknown')}\n"
            f"Changes:    {lineage.get('changes_summary', 'none')}",
            title="Lineage Details",
            border_style="blue",
        ))
