"""Fork/modify existing DNA files with remix metadata."""

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

import typer
from rich.console import Console
from rich.panel import Panel

console = Console()


def remix_file(file_path: str, output_path: str | None = None) -> None:
    """Copy a DNA file and add remix metadata."""
    src = Path(file_path)

    if not src.exists():
        console.print(f"[bold red]Error:[/] File not found: {file_path}")
        raise typer.Exit(code=1)

    # Read the original
    try:
        with open(src) as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        console.print(f"[bold red]Error:[/] Invalid JSON: {e}")
        raise typer.Exit(code=1)

    # Determine output path
    if output_path is None:
        output_path = f"remix_of_{src.name}"

    dst = Path(output_path)

    if dst.exists():
        console.print(f"[yellow]Warning:[/] {dst} already exists. Overwrite? [y/N] ", end="")
        if not typer.confirm("", default=False):
            console.print("Aborted.")
            raise typer.Exit(code=0)

    # Add remix metadata to meta
    now = datetime.now(timezone.utc).isoformat()
    if "meta" not in data:
        data["meta"] = {}

    data["meta"]["remix_of"] = str(src.resolve())
    data["meta"]["remix_date"] = now

    # If there's an original_file chain, preserve it
    if "original_file" in data["meta"]:
        data["meta"]["remix_chain"] = data["meta"].get("remix_chain", [])
        data["meta"]["remix_chain"].append(data["meta"]["original_file"])

    data["meta"]["original_file"] = str(src.resolve())

    # Write out
    with open(dst, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")

    console.print(Panel(
        f"[bold green]Remix created[/] → [cyan]{dst}[/]",
        title="forge remix",
        border_style="green",
    ))
    console.print(f"  Original: {src}")
    console.print(f"  Remix date: {now}")
    console.print(f"  Edit at: {dst.resolve()}")
