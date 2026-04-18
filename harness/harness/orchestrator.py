"""Orchestrate build plan execution with agent dispatch."""
import json
from pathlib import Path
from typing import Any, Callable

from .agent_specs import AGENT_REGISTRY, AgentType
from .task_decomposer import BuildPlan, BuildTask, TaskStatus


class Orchestrator:
    """Manages execution of a build plan."""

    def __init__(self, plan: BuildPlan, output_dir: str = "./build_output"):
        self.plan = plan
        self.output_dir = Path(output_dir)
        self.callbacks: list[Callable] = []
        self.hooks: dict[str, list[Callable]] = {}

    def on_task_start(self, callback: Callable):
        """Register a callback for when a task starts."""
        self.hooks.setdefault("start", []).append(callback)

    def on_task_complete(self, callback: Callable):
        """Register a callback for when a task completes."""
        self.hooks.setdefault("complete", []).append(callback)

    def on_task_fail(self, callback: Callable):
        """Register a callback for when a task fails."""
        self.hooks.setdefault("fail", []).append(callback)

    def _emit(self, event: str, task: BuildTask, **kwargs):
        for cb in self.hooks.get(event, []):
            cb(task, **kwargs)

    def get_ready_tasks(self) -> list[BuildTask]:
        """Get all tasks ready to execute."""
        return self.plan.ready_tasks()

    def get_parallel_groups(self) -> list[list[BuildTask]]:
        """Group ready tasks by whether they can run in parallel."""
        ready = self.get_ready_tasks()
        parallel = [t for t in ready if AGENT_REGISTRY[t.agent_type].can_parallelize]
        serial = [t for t in ready if not AGENT_REGISTRY[t.agent_type].can_parallelize]
        groups = []
        if parallel:
            groups.append(parallel)
        for t in serial:
            groups.append([t])
        return groups

    def start_task(self, task: BuildTask) -> bool:
        """Mark a task as running."""
        if task.status != TaskStatus.PENDING:
            return False
        task.status = TaskStatus.RUNNING
        self._emit("start", task)
        return True

    def complete_task(self, task: BuildTask, output_path: str = "") -> bool:
        """Mark a task as completed."""
        if task.status != TaskStatus.RUNNING:
            return False
        task.status = TaskStatus.COMPLETED
        task.output_path = output_path
        self._emit("complete", task, output_path=output_path)
        return True

    def fail_task(self, task: BuildTask, error: str = "") -> bool:
        """Mark a task as failed."""
        if task.status != TaskStatus.RUNNING:
            return False
        task.status = TaskStatus.FAILED
        self._emit("fail", task, error=error)
        return False

    def skip_task(self, task: BuildTask) -> bool:
        """Skip a task (dependency failed)."""
        task.status = TaskStatus.SKIPPED
        return True

    def is_complete(self) -> bool:
        """Check if all tasks are done (completed, failed, or skipped)."""
        return all(t.status in (TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.SKIPPED) for t in self.plan.tasks)

    def generate_agent_prompt(self, task: BuildTask) -> str:
        """Generate a prompt for an agent to execute this task."""
        spec = AGENT_REGISTRY[task.agent_type]
        prompt = f"""You are a {spec.name}. {spec.description}

## Task: {task.name}
{task.description}

## Input Data
```json
{json.dumps(task.input_data, indent=2)}
```

## Output
Generate all files needed for this task. Write them to the output directory.
Each file should be complete, production-ready, and follow best practices.

## Constraints
- Follow the game's art style and genre conventions
- Ensure all generated content is self-contained and referenceable
- Use clear naming conventions for files and assets
- Include metadata headers in generated files
"""
        # Add dependency context
        completed_deps = [
            t for t in self.plan.tasks
            if t.task_id in task.dependencies and t.status == TaskStatus.COMPLETED
        ]
        if completed_deps:
            prompt += "\n## Completed Dependencies\n"
            for dep in completed_deps:
                prompt += f"- {dep.name}: {dep.output_path or 'generated'}\n"

        return prompt

    def generate_execution_report(self) -> dict[str, Any]:
        """Generate a report of the build execution."""
        stats = self.plan.stats()
        return {
            "game_title": self.plan.game_title,
            "total_tasks": stats["total"],
            "completed": stats["by_status"].get("completed", 0),
            "failed": stats["by_status"].get("failed", 0),
            "skipped": stats["by_status"].get("skipped", 0),
            "pending": stats["by_status"].get("pending", 0),
            "ready": stats["by_status"].get("ready", 0),
            "by_agent_type": stats["by_agent"],
            "completion_pct": round(100 * stats["by_status"].get("completed", 0) / max(stats["total"], 1), 1),
        }

    def save_plan(self, path: str):
        """Save the build plan to JSON."""
        with open(path, "w") as f:
            json.dump(self.plan.to_dict(), f, indent=2)

    def load_plan(self, path: str):
        """Load a build plan from JSON."""
        with open(path) as f:
            data = json.load(f)
        # Reconstruct tasks from dict
        from .task_decomposer import BuildTask, TaskStatus
        self.plan.game_title = data["game_title"]
        self.plan.tasks = []
        for td in data["tasks"]:
            task = BuildTask(
                task_id=td["task_id"],
                agent_type=AgentType(td["agent_type"]),
                name=td["name"],
                description=td["description"],
                input_data=td.get("input_data", {}),
                dependencies=td.get("dependencies", []),
                status=TaskStatus(td.get("status", "pending")),
                output_path=td.get("output_path", ""),
                priority=td.get("priority", 0),
            )
            self.plan.tasks.append(task)
        self.plan.phases = data.get("phases", [])
