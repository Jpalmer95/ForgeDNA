"""ForgeDNA CLI — Typer application with all commands."""

import typer
from rich.console import Console
from rich.table import Table

app = typer.Typer(
    name="forgedna",
    help="ForgeDNA — Create, validate, and manage game DNA design files.",
    no_args_is_help=True,
    add_completion=False,
)
console = Console()


@app.command()
def validate(
    file: str = typer.Argument(help="Path to game_dna.json file to validate."),
):
    """Validate a game DNA file against the ForgeDNA schema."""
    from forgedna.validate import validate_file

    success = validate_file(file)
    raise typer.Exit(code=0 if success else 1)


@app.command("init")
def init_cmd(
    template: str = typer.Option(
        "minimal", "--template", "-t", help="Template to use: minimal, rpg, platformer, puzzle"
    ),
    output: str = typer.Option(
        "game_dna.json", "--output", "-o", help="Output file path"
    ),
):
    """Create a new game DNA file from a built-in template."""
    from forgedna.init import create_from_template

    create_from_template(template, output)


@app.command()
def remix(
    file: str = typer.Argument(help="Path to existing game DNA file to remix."),
    output: str = typer.Option(None, "--output", "-o", help="Output file path"),
):
    """Fork an existing DNA file with remix metadata."""
    from forgedna.remix import remix_file

    remix_file(file, output)


@app.command()
def info(
    file: str = typer.Argument(help="Path to game DNA file to inspect."),
):
    """Show summary statistics about a game DNA file."""
    from forgedna.info import show_info

    show_info(file)


@app.command()
def diff(
    file1: str = typer.Argument(help="First game DNA file."),
    file2: str = typer.Argument(help="Second game DNA file."),
):
    """Compare two game DNA files and show differences."""
    from forgedna.diff import compare_files

    compare_files(file1, file2)


@app.command("list-templates")
def list_templates():
    """List all available built-in templates."""
    from forgedna.init import TEMPLATES

    table = Table(title="Available ForgeDNA Templates", show_lines=True)
    table.add_column("Name", style="cyan", no_wrap=True)
    table.add_column("Description", style="green")
    table.add_column("File", style="dim")

    for name, info in TEMPLATES.items():
        table.add_row(name, info["description"], f"{name}.json")

    console.print(table)


@app.command()
def export(
    file: str = typer.Argument(help="Path to game DNA file to export."),
    format: str = typer.Option(
        ..., "--format", "-f", help="Export format: summary or prompt"
    ),
):
    """Export a game DNA file as markdown summary or AI agent prompt."""
    from forgedna.export import export_file

    export_file(file, format)
