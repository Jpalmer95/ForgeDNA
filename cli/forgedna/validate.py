"""Schema validation logic for ForgeDNA game DNA files."""

import json
from pathlib import Path

import jsonschema
from rich.console import Console
from rich.panel import Panel

console = Console()

# Find the schema file inside the package
SCHEMA_PATH = Path(__file__).parent / "schemas" / "game_dna.schema.json"


def _strip_comments(obj):
    """Recursively remove _comment fields from a dict/list structure."""
    if isinstance(obj, dict):
        return {k: _strip_comments(v) for k, v in obj.items() if k != "_comment"}
    elif isinstance(obj, list):
        return [_strip_comments(item) for item in obj]
    return obj


def _load_schema() -> dict:
    with open(SCHEMA_PATH) as f:
        return json.load(f)


def _find_line_number(json_text: str, path: str) -> int:
    """Approximate the line number where a JSON path error occurs."""
    # Walk the path and try to find the key in the JSON text
    parts = path.replace("$.", "").split(".")
    last_key = parts[-1] if parts else ""
    for i, line in enumerate(json_text.splitlines(), 1):
        stripped = line.strip()
        if f'"{last_key}"' in stripped:
            return i
    return 0


def _format_error_path(error: jsonschema.ValidationError) -> str:
    """Convert a jsonschema error path to a readable string."""
    path_parts = [str(p) for p in error.absolute_path]
    if path_parts:
        return "$." + ".".join(path_parts)
    return "$ (root)"


def _humanize_error(error: jsonschema.ValidationError) -> str:
    """Create a human-readable error message from a validation error."""
    path = _format_error_path(error)

    if error.validator == "required":
        missing = error.message.split("'")[1] if "'" in error.message else "unknown"
        return f"Missing required field: '{missing}' at {path}"

    if error.validator == "type":
        return f"Type error at {path}: {error.message}"

    if error.validator == "enum":
        return f"Invalid value at {path}: {error.message}"

    if error.validator == "additionalProperties":
        return f"Unexpected property at {path}: {error.message}"

    if error.validator == "minItems":
        return f"Too few items at {path}: {error.message}"

    if error.validator == "const":
        return f"Wrong constant value at {path}: {error.message}"

    return f"Validation error at {path}: {error.message}"


def validate_file(filepath: str) -> bool:
    """Validate a game DNA JSON file against the ForgeDNA schema.

    Returns True if valid, False otherwise.
    """
    path = Path(filepath)

    if not path.exists():
        console.print(f"[bold red]Error:[/] File not found: {filepath}")
        return False

    # Read file content
    try:
        with open(path) as f:
            content = f.read()
            data = json.loads(content)
    except json.JSONDecodeError as e:
        console.print(f"[bold red]Error:[/] Invalid JSON in {filepath}")
        console.print(f"  Line {e.lineno}, Col {e.colno}: {e.msg}")
        return False

    # Strip _comment fields (non-standard, used as JSON comments)
    data = _strip_comments(data)

    # Load and validate
    schema = _load_schema()

    try:
        jsonschema.validate(instance=data, schema=schema)
    except jsonschema.ValidationError as e:
        # This shouldn't happen as we use iter_errors, but just in case
        console.print(Panel("[bold red]Validation FAILED[/]", border_style="red"))
        console.print(f"  {_humanize_error(e)}")
        return False

    # Also check with iter_errors for multiple errors
    validator = jsonschema.Draft7Validator(schema)
    errors = list(validator.iter_errors(data))

    if errors:
        console.print(Panel(
            f"[bold red]Validation FAILED[/] — {len(errors)} error(s) found",
            border_style="red",
        ))
        for i, error in enumerate(errors, 1):
            human_msg = _humanize_error(error)
            line_num = _find_line_number(content, _format_error_path(error))
            line_info = f" [dim](line ~{line_num})[/]" if line_num else ""
            console.print(f"  [red]{i}.[/] {human_msg}{line_info}")

        return False

    # Success
    title = data.get("meta", {}).get("title", "Unknown")
    console.print(Panel(
        f"[bold green]Validation PASSED[/] — [cyan]{title}[/]",
        border_style="green",
    ))
    return True
