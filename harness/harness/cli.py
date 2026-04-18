"""ForgeDNA Substrate Harness CLI."""
import json
import sys
from pathlib import Path

import typer
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.tree import Tree

from .agent_specs import AGENT_REGISTRY
from .dna_parser import load_dna
from .orchestrator import Orchestrator
from .task_decomposer import decompose

app = typer.Typer(
    name="forgedna-harness",
    help="Substrate Harness — Turn GameDNA schemas into games with AI agents.",
    add_completion=False,
)
console = Console()


@app.command()
def parse(
    dna_file: Path = typer.Argument(..., help="Path to game_dna.json file", exists=True),
):
    """Parse a GameDNA file and show its structure."""
    dna = load_dna(dna_file)
    summary = dna.summary()

    console.print(Panel(f"[bold cyan]{summary['title']}[/bold cyan]", title="GameDNA Parsed"))

    table = Table(title="Summary")
    table.add_column("Property", style="cyan")
    table.add_column("Value", style="green")

    for key, value in summary.items():
        if key != "title":
            table.add_row(key.replace("_", " ").title(), str(value))

    console.print(table)


@app.command()
def plan(
    dna_file: Path = typer.Argument(..., help="Path to game_dna.json file", exists=True),
    output: Path = typer.Option(None, "--output", "-o", help="Save plan to JSON file"),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Show all tasks"),
):
    """Generate a build plan from a GameDNA file."""
    dna = load_dna(dna_file)
    build_plan = decompose(dna)
    stats = build_plan.stats()

    console.print(Panel(
        f"[bold]{dna.title}[/bold]\n"
        f"Total tasks: [cyan]{stats['total']}[/cyan]",
        title="[bold green]Build Plan Generated"
    ))

    # Show by agent type
    table = Table(title="Tasks by Agent Type")
    table.add_column("Agent", style="cyan")
    table.add_column("Count", style="green", justify="right")
    table.add_column("Description")

    for agent_type, tasks in build_plan.tasks_by_agent().items():
        spec = AGENT_REGISTRY[agent_type]
        table.add_row(spec.name, str(len(tasks)), spec.description[:60])

    console.print(table)

    # Show phases
    phase_table = Table(title="Build Phases")
    phase_table.add_column("Phase", style="cyan")
    phase_table.add_column("Tasks", style="green", justify="right")

    for phase in build_plan.phases:
        phase_table.add_row(phase["name"], str(len(phase["tasks"])))

    console.print(phase_table)

    # Show task tree if verbose
    if verbose:
        tree = Tree(f"[bold]{dna.title} Build Tasks")
        for phase in build_plan.phases:
            branch = tree.add(f"[cyan]{phase['name']}")
            for tid in phase["tasks"]:
                task = next((t for t in build_plan.tasks if t.task_id == tid), None)
                if task:
                    spec = AGENT_REGISTRY[task.agent_type]
                    branch.add(f"[green]{task.name}[/green] [{spec.name}]")
        console.print(tree)

    # Save if requested
    if output:
        orch = Orchestrator(build_plan)
        orch.save_plan(str(output))
        console.print(f"\n[green]Plan saved to {output}")


@app.command()
def dry_run(
    dna_file: Path = typer.Argument(..., help="Path to game_dna.json file", exists=True),
    output_dir: Path = typer.Option("./build_output", "--output-dir", "-d", help="Build output directory"),
):
    """Simulate a build without actually generating anything."""
    dna = load_dna(dna_file)
    build_plan = decompose(dna)
    orch = Orchestrator(build_plan, str(output_dir))

    console.print(Panel(
        f"[bold]{dna.title}[/bold]\n"
        f"Simulating build to: {output_dir}",
        title="[bold yellow]Dry Run"
    ))

    # Simulate execution in dependency order
    iteration = 0
    while not orch.is_complete():
        ready = orch.get_ready_tasks()
        if not ready:
            # Mark remaining pending tasks as skipped (broken deps)
            for task in build_plan.tasks:
                if task.status.value == "pending":
                    orch.skip_task(task)
            break

        iteration += 1
        console.print(f"\n[bold]Iteration {iteration}:[/bold] {len(ready)} tasks ready")

        for task in ready:
            orch.start_task(task)
            spec = AGENT_REGISTRY[task.agent_type]
            console.print(f"  [cyan]→[/cyan] {task.name} [{spec.name}]")
            orch.complete_task(task, output_path=f"{output_dir}/{task.task_id}")

    # Final report
    report = orch.generate_execution_report()
    console.print(Panel(
        f"Total: {report['total_tasks']}\n"
        f"Completed: [green]{report['completed']}[/green]\n"
        f"Failed: [red]{report['failed']}[/red]\n"
        f"Skipped: [yellow]{report['skipped']}[/yellow]\n"
        f"Progress: [cyan]{report['completion_pct']}%[/cyan]",
        title="[bold green]Dry Run Complete"
    ))


@app.command()
def serve(
    port: int = typer.Option(8080, "--port", "-p", help="Port to listen on"),
    dna_file: Path = typer.Option(None, "--dna", "-d", help="Pre-load a GameDNA file"),
):
    """Start the MCP server for agent-driven game building."""
    from .mcp_server import HarnessMCPServer, create_sse_app

    server = HarnessMCPServer()

    if dna_file:
        result = server.parse_game_dna(str(dna_file))
        if result["success"]:
            console.print(f"[green]Pre-loaded: {result['title']}")
        else:
            console.print(f"[red]Failed to load: {result['error']}")

    console.print(Panel(
        f"MCP Server starting on port {port}\n\n"
        f"Endpoints:\n"
        f"  GET  /tools    — List available tools\n"
        f"  POST /call     — Call a tool (JSON body)\n"
        f"  POST /tools/{{name}} — Call tool by name\n\n"
        f"Compatible with: Hermes Agent, Claude Code, LM Studio, any MCP client",
        title="[bold green]ForgeDNA Harness MCP Server"
    ))

    try:
        import uvicorn
        app = create_sse_app(server)
        uvicorn.run(app, host="0.0.0.0", port=port)
    except ImportError:
        console.print("[yellow]Install uvicorn for SSE support: pip install uvicorn fastapi")
        console.print("[cyan]Falling back to interactive mode...")
        _interactive_mode(server)


def _interactive_mode(server):
    """Interactive REPL for calling tools without an HTTP server."""
    console.print("[cyan]Interactive mode. Type 'tools' to list tools, 'quit' to exit.\n")

    while True:
        try:
            cmd = console.input("[bold cyan]>[/bold cyan] ").strip()
        except (EOFError, KeyboardInterrupt):
            break

        if cmd in ("quit", "exit", "q"):
            break
        elif cmd == "tools":
            tools = server.get_tools()
            for t in tools:
                console.print(f"  [green]{t['name']}[/green] — {t['description'][:60]}")
        elif cmd.startswith("parse "):
            result = server.parse_game_dna(cmd[6:].strip())
            console.print_json(json.dumps(result, indent=2))
        elif cmd.startswith("plan "):
            result = server.generate_build_plan(cmd[5:].strip())
            console.print_json(json.dumps(result, indent=2))
        elif cmd.startswith("next "):
            parts = cmd[5:].strip().split()
            result = server.get_next_tasks(parts[0], parts[1] if len(parts) > 1 else "")
            console.print_json(json.dumps(result, indent=2))
        elif cmd.startswith("status "):
            result = server.get_build_status(cmd[7:].strip())
            console.print_json(json.dumps(result, indent=2))
        elif cmd == "":
            pass
        else:
            console.print("[dim]Commands: tools, parse <file>, plan <file>, next <plan_id>, status <plan_id>, quit")


@app.command()
def build(
    dna_file: Path = typer.Argument(..., help="Path to game_dna.json file", exists=True),
    output_dir: Path = typer.Option("./build_output", "--output", "-o", help="Output directory"),
    max_parallel: int = typer.Option(4, "--parallel", "-j", help="Max parallel agents"),
    dry_run_flag: bool = typer.Option(False, "--dry-run", help="Simulate without generating"),
):
    """Run an actual build using agent executors."""
    from .executors import get_executor

    dna = load_dna(dna_file)
    build_plan = decompose(dna)
    orch = Orchestrator(build_plan, str(output_dir))

    console.print(Panel(
        f"[bold]{dna.title}[/bold]\n"
        f"Output: {output_dir}\n"
        f"Tasks: {len(build_plan.tasks)}\n"
        f"Max parallel: {max_parallel}",
        title="[bold green]Starting Build"
    ))

    iteration = 0
    while not orch.is_complete():
        ready = orch.get_ready_tasks()
        if not ready:
            for task in build_plan.tasks:
                if task.status.value == "pending":
                    # Check if deps failed
                    dep_failed = any(
                        next((t for t in build_plan.tasks if t.task_id == d), None)
                        and next((t for t in build_plan.tasks if t.task_id == d)).status.value == "failed"
                        for d in task.dependencies
                    )
                    if dep_failed:
                        orch.skip_task(task)
                    else:
                        orch.skip_task(task)
            break

        iteration += 1
        batch = ready[:max_parallel]

        console.print(f"\n[bold]━━━ Iteration {iteration} — {len(batch)} tasks ━━━[/bold]")

        for task in batch:
            orch.start_task(task)
            spec = AGENT_REGISTRY[task.agent_type]

            if dry_run_flag:
                console.print(f"  [yellow]DRY[/yellow] {task.name} [{spec.name}]")
                orch.complete_task(task, f"{output_dir}/{task.task_id}")
            else:
                console.print(f"  [cyan]RUN[/cyan] {task.name} [{spec.name}]")

                executor = get_executor(task.agent_type, str(output_dir))
                if executor:
                    try:
                        result = executor.execute(task)
                        if result["success"]:
                            orch.complete_task(task, result.get("output_path", ""))
                            console.print(f"  [green]OK[/green]  → {result.get('output_path', 'done')}")
                        else:
                            orch.fail_task(task, result.get("error", "unknown"))
                            console.print(f"  [red]FAIL[/red] {result.get('error', 'unknown')}")
                    except Exception as e:
                        orch.fail_task(task, str(e))
                        console.print(f"  [red]ERR[/red]  {e}")
                else:
                    console.print(f"  [yellow]SKIP[/yellow] (no executor for {task.agent_type.value})")
                    orch.complete_task(task, "")

    # Final report
    report = orch.generate_execution_report()
    console.print(Panel(
        f"Total: {report['total_tasks']}\n"
        f"Completed: [green]{report['completed']}[/green]\n"
        f"Failed: [red]{report['failed']}[/red]\n"
        f"Skipped: [yellow]{report['skipped']}[/yellow]\n"
        f"Progress: [cyan]{report['completion_pct']}%[/cyan]",
        title="[bold green]Build Complete"
    ))

    # Save plan
    plan_path = Path(output_dir) / "build_plan.json"
    plan_path.parent.mkdir(parents=True, exist_ok=True)
    orch.save_plan(str(plan_path))
    console.print(f"\n[cyan]Build plan saved to {plan_path}")


@app.command()
def agents():
    """List all available agent types and their capabilities."""
    table = Table(title="Available Agent Types")
    table.add_column("Type", style="cyan")
    table.add_column("Name", style="green")
    table.add_column("Parallel", justify="center")
    table.add_column("Max", justify="center")
    table.add_column("Tools")
    table.add_column("Models")

    for spec in AGENT_REGISTRY.values():
        table.add_row(
            spec.agent_type.value,
            spec.name,
            "Yes" if spec.can_parallelize else "No",
            str(spec.max_instances),
            ", ".join(spec.tools_required[:3]),
            ", ".join(spec.models_required[:2]) or "none",
        )

    console.print(table)


@app.command()
def prompt(
    dna_file: Path = typer.Argument(..., help="Path to game_dna.json file", exists=True),
    task_id: str = typer.Argument(..., help="Task ID to generate prompt for"),
    plan_file: Path = typer.Option(None, "--plan", "-p", help="Load plan from file"),
):
    """Generate an agent prompt for a specific task."""
    dna = load_dna(dna_file)

    if plan_file:
        build_plan = decompose(dna)
        orch = Orchestrator(build_plan)
        orch.load_plan(str(plan_file))
    else:
        build_plan = decompose(dna)
        orch = Orchestrator(build_plan)

    task = next((t for t in build_plan.tasks if t.task_id == task_id), None)
    if not task:
        console.print(f"[red]Task '{task_id}' not found. Use 'plan' to see available tasks.")
        raise typer.Exit(1)

    # Mark dependencies as completed so the prompt includes context
    for dep_id in task.dependencies:
        dep = next((t for t in build_plan.tasks if t.task_id == dep_id), None)
        if dep:
            from .task_decomposer import TaskStatus
            dep.status = TaskStatus.COMPLETED

    prompt_text = orch.generate_agent_prompt(task)
    console.print(Panel(prompt_text, title=f"Agent Prompt: {task.name}"))


@app.command()
def stat(
    dna_file: Path = typer.Argument(..., help="Path to game_dna.json file", exists=True),
):
    """Show detailed statistics about a GameDNA file — how much work it represents."""
    dna = load_dna(dna_file)
    build_plan = decompose(dna)
    stats = build_plan.stats()

    summary = dna.summary()

    console.print(Panel(f"[bold]{summary['title']}[/bold]", title="GameDNA Statistics"))

    # Content counts
    table = Table(title="Content Inventory")
    table.add_column("Category", style="cyan")
    table.add_column("Count", style="green", justify="right")

    for key, value in summary.items():
        if isinstance(value, int) and value > 0:
            table.add_row(key.replace("_", " ").title(), str(value))
    console.print(table)

    # Build estimate
    build_table = Table(title="Build Plan Estimate")
    build_table.add_column("Agent Type", style="cyan")
    build_table.add_column("Tasks", style="green", justify="right")

    for agent_type, tasks in build_plan.tasks_by_agent().items():
        spec = AGENT_REGISTRY[agent_type]
        build_table.add_row(spec.name, str(len(tasks)))
    build_table.add_row("[bold]Total", f"[bold]{stats['total']}")
    console.print(build_table)

    # Parallelism analysis
    max_parallel = sum(
        len(tasks) for atype, tasks in build_plan.tasks_by_agent().items()
        if AGENT_REGISTRY[atype].can_parallelize
    )
    serial = sum(
        len(tasks) for atype, tasks in build_plan.tasks_by_agent().items()
        if not AGENT_REGISTRY[atype].can_parallelize
    )
    console.print(f"\n[cyan]Max parallel tasks:[/cyan] {max_parallel}")
    console.print(f"[cyan]Serial tasks:[/cyan] {serial}")
    console.print(f"[cyan]Theoretical min iterations:[/cyan] ~{max(3, serial + 2)}")


if __name__ == "__main__":
    app()
