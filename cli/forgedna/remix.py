"""Remix DNA with proper lineage tracking (UUID-based ancestry)."""

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

import typer
from rich.console import Console
from rich.panel import Panel

console = Console()


def remix_file(
    file_path: str,
    output_path: str | None = None,
    author: str = "anonymous",
    changes: str = "",
) -> None:
    """Fork a DNA file with full lineage metadata."""
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

    # Determine output path
    if output_path is None:
        stem = src.stem
        output_path = f"{stem}_remix.json"

    dst = Path(output_path)

    if dst.exists():
        console.print(f"[yellow]Warning:[/] {dst} already exists. Overwrite? [y/N] ", end="")
        if not typer.confirm("", default=False):
            console.print("Aborted.")
            raise typer.Exit(code=0)

    # Ensure meta exists
    if "meta" not in data:
        data["meta"] = {}

    now = datetime.now(timezone.utc).isoformat()
    new_dna_id = str(uuid.uuid4())

    # Get parent lineage info
    parent_lineage = data["meta"].get("lineage", {})
    parent_id = parent_lineage.get("dna_id", str(uuid.uuid5(uuid.NAMESPACE_URL, str(src.resolve()))))
    original_id = parent_lineage.get("original_id", parent_id)
    parent_gen = parent_lineage.get("generation", 0)
    parent_title = data["meta"].get("title", src.stem)

    # Build ancestors list
    ancestors = parent_lineage.get("ancestors", [])
    ancestors.append({
        "dna_id": parent_id,
        "title": parent_title,
        "author": data["meta"].get("author", "unknown"),
        "generation": parent_gen,
    })

    # Set new lineage
    data["meta"]["lineage"] = {
        "dna_id": new_dna_id,
        "original_id": original_id,
        "parent_id": parent_id,
        "generation": parent_gen + 1,
        "remixed_by": author,
        "remixed_at": now,
        "changes_summary": changes if changes else f"Remix of {parent_title}",
        "ancestors": ancestors,
    }

    # Clean up legacy remix fields
    for key in ("remix_of", "remix_date", "original_file", "remix_chain"):
        data["meta"].pop(key, None)

    # Update timestamps
    if "created_at" not in data["meta"]:
        data["meta"]["created_at"] = now
    data["meta"]["updated_at"] = now
    if "author" not in data["meta"]:
        data["meta"]["author"] = author

    # Write out
    with open(dst, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")

    gen = data["meta"]["lineage"]["generation"]
    console.print(Panel(
        f"[bold green]Remix created[/] (generation {gen})\n"
        f"DNA ID: [cyan]{new_dna_id}[/]\n"
        f"Parent: [dim]{parent_id[:8]}...[/]\n"
        f"Original: [dim]{original_id[:8]}...[/]",
        title="forge remix",
        border_style="green",
    ))
    console.print(f"  Source:  {src.resolve()}")
    console.print(f"  Output:  {dst.resolve()}")
    console.print(f"  Author:  {author}")
