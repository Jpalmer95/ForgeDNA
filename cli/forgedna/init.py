"""Create new game DNA files from built-in templates."""

import json
import shutil
from pathlib import Path

import typer
from rich.console import Console
from rich.panel import Panel

console = Console()

TEMPLATES_DIR = Path(__file__).parent / "templates"

TEMPLATES = {
    "minimal": {
        "description": "Bare minimum game DNA skeleton — just the required fields.",
    },
    "rpg": {
        "description": "RPG-focused template with combat, progression, crafting, and quests.",
    },
    "platformer": {
        "description": "2D platformer template with movement mechanics and level structure.",
    },
    "puzzle": {
        "description": "Puzzle game template with mechanics defined and minimal world.",
    },
}


def list_template_names() -> list[str]:
    return list(TEMPLATES.keys())


def create_from_template(template_name: str, output_path: str) -> None:
    """Create a new game DNA file from a built-in template."""
    if template_name not in TEMPLATES:
        console.print(f"[bold red]Error:[/] Unknown template '{template_name}'")
        console.print(f"Available templates: {', '.join(TEMPLATES.keys())}")
        raise typer.Exit(code=1)

    src = TEMPLATES_DIR / f"{template_name}.json"
    if not src.exists():
        console.print(f"[bold red]Error:[/] Template file not found: {src}")
        raise typer.Exit(code=1)

    dst = Path(output_path)

    if dst.exists():
        console.print(f"[yellow]Warning:[/] {dst} already exists. Overwrite? [y/N] ", end="")
        if not typer.confirm("", default=False):
            console.print("Aborted.")
            raise typer.Exit(code=0)

    shutil.copy2(src, dst)

    console.print(Panel(
        f"[bold green]Created[/] [cyan]{dst}[/] from template [yellow]{template_name}[/]",
        title="forge init",
        border_style="green",
    ))
    console.print(f"  Template: {TEMPLATES[template_name]['description']}")
    console.print(f"  Edit the file to customize your game design!")
