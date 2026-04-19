"""BuildManager — The core execution loop that builds games from DNA.

This is the heart of ForgeDNA: it reads a game_dna.json, decomposes it into tasks,
dispatches each task to the appropriate agent, collects generated files, and
assembles everything into a playable game.
"""
import json
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Optional

from ..agent_specs import AGENT_REGISTRY, AgentType
from ..dna_parser import GameDNA, load_dna
from ..orchestrator import Orchestrator
from ..task_decomposer import BuildPlan, BuildTask, TaskStatus, decompose
from . import AgentConfig, AgentBackend, AgentProtocol, TaskResult
from .implementations import SubprocessAgent, APIAgent, HFAgent, MCPAgent, DryRunAgent


# ─── Agent Type → Backend Mapping ───

DEFAULT_AGENT_CONFIGS: dict[AgentType, AgentConfig] = {
    # Code agents — default to subprocess (claude)
    AgentType.CODE_PLAYER: AgentConfig(name="Player Agent", backend=AgentBackend.SUBPROCESS, command="claude", args_template=["--acp", "--stdio"]),
    AgentType.CODE_ENEMY: AgentConfig(name="Enemy Agent", backend=AgentBackend.SUBPROCESS, command="claude", args_template=["--acp", "--stdio"]),
    AgentType.CODE_COMBAT: AgentConfig(name="Combat Agent", backend=AgentBackend.SUBPROCESS, command="claude", args_template=["--acp", "--stdio"]),
    AgentType.CODE_QUEST: AgentConfig(name="Quest Agent", backend=AgentBackend.SUBPROCESS, command="claude", args_template=["--acp", "--stdio"]),
    AgentType.CODE_CRAFTING: AgentConfig(name="Crafting Agent", backend=AgentBackend.SUBPROCESS, command="claude", args_template=["--acp", "--stdio"]),
    AgentType.CODE_UI: AgentConfig(name="UI Agent", backend=AgentBackend.SUBPROCESS, command="claude", args_template=["--acp", "--stdio"]),
    AgentType.CODE_WORLD: AgentConfig(name="World Agent", backend=AgentBackend.SUBPROCESS, command="claude", args_template=["--acp", "--stdio"]),
    # Asset agents — default to HF inference
    AgentType.TEXTURE: AgentConfig(name="Texture Agent", backend=AgentBackend.HF, hf_model="stabilityai/stable-diffusion-xl-base-1.0", hf_task="text-to-image"),
    AgentType.AUDIO_MUSIC: AgentConfig(name="Music Agent", backend=AgentBackend.HF, hf_model="facebook/musicgen-medium", hf_task="text-to-audio"),
    AgentType.AUDIO_SFX: AgentConfig(name="SFX Agent", backend=AgentBackend.HF, hf_model="facebook/musicgen-small", hf_task="text-to-audio"),
    AgentType.AUDIO_AMBIENT: AgentConfig(name="Ambient Agent", backend=AgentBackend.HF, hf_model="haoheliu/audio-lms", hf_task="text-to-audio"),
    # Assembly/test — no agent needed (file operations)
    AgentType.ASSEMBLY: AgentConfig(name="Assembly", backend=AgentBackend.DRY_RUN),
    AgentType.TEST: AgentConfig(name="Test", backend=AgentBackend.DRY_RUN),
}


def create_agent(config: AgentConfig) -> AgentProtocol:
    """Factory to create an agent from config."""
    if config.backend == AgentBackend.SUBPROCESS:
        return SubprocessAgent(config)
    elif config.backend == AgentBackend.API:
        return APIAgent(config)
    elif config.backend == AgentBackend.HF:
        return HFAgent(config)
    elif config.backend == AgentBackend.MCP:
        return MCPAgent(config)
    else:
        return DryRunAgent(config)


@dataclass
class BuildConfig:
    """Configuration for a build run."""
    dna_file: str
    output_dir: str = "./build_output"
    max_parallel: int = 4
    dry_run: bool = False
    engine: str = "godot"                   # Target engine
    engine_config: dict[str, Any] = field(default_factory=dict)
    agent_configs: dict[str, AgentConfig] = field(default_factory=dict)  # Override per agent type
    default_backend: AgentBackend = AgentBackend.DRY_RUN
    on_task_start: Optional[Callable] = None
    on_task_complete: Optional[Callable] = None
    on_task_fail: Optional[Callable] = None
    on_progress: Optional[Callable] = None


class BuildManager:
    """Manages a full game build from DNA to output."""

    def __init__(self, config: BuildConfig):
        self.config = config
        self.dna: Optional[GameDNA] = None
        self.plan: Optional[BuildPlan] = None
        self.orchestrator: Optional[Orchestrator] = None
        self.agents: dict[AgentType, AgentProtocol] = {}
        self.results: list[TaskResult] = []
        self.start_time: float = 0

    def _init_agents(self):
        """Initialize agent instances from config."""
        for agent_type in AgentType:
            # Check for override config
            type_key = agent_type.value
            if type_key in self.config.agent_configs:
                agent_config = self.config.agent_configs[type_key]
            elif agent_type in DEFAULT_AGENT_CONFIGS:
                agent_config = DEFAULT_AGENT_CONFIGS[agent_type]
            else:
                agent_config = AgentConfig(name=type_key, backend=self.config.default_backend)

            # Override to dry_run if in dry mode
            if self.config.dry_run:
                agent_config = AgentConfig(name=f"{agent_config.name} (dry)", backend=AgentBackend.DRY_RUN)

            agent = create_agent(agent_config)
            self.agents[agent_type] = agent

    def prepare(self) -> dict[str, Any]:
        """Parse DNA and generate build plan (without executing)."""
        self.dna = load_dna(self.config.dna_file)
        self.plan = decompose(self.dna)
        self.orchestrator = Orchestrator(self.plan, self.config.output_dir)
        self._init_agents()

        stats = self.plan.stats()
        available = sum(1 for a in self.agents.values() if a.is_available())

        return {
            "game_title": self.dna.title,
            "total_tasks": stats["total"],
            "phases": self.plan.phases,
            "agents_available": available,
            "agents_total": len(self.agents),
        }

    def execute(self) -> dict[str, Any]:
        """Run the full build pipeline."""
        if not self.plan:
            self.prepare()

        self.start_time = time.time()
        iteration = 0
        total = len(self.plan.tasks)
        completed = 0
        failed = 0

        while not self.orchestrator.is_complete():
            ready = self.orchestrator.get_ready_tasks()
            if not ready:
                # Mark remaining as skipped
                for task in self.plan.tasks:
                    if task.status == TaskStatus.PENDING:
                        deps_failed = any(
                            next((t for t in self.plan.tasks if t.task_id == d), None)
                            and next((t for t in self.plan.tasks if t.task_id == d)).status == TaskStatus.FAILED
                            for d in task.dependencies
                        )
                        if deps_failed:
                            task.status = TaskStatus.SKIPPED
                break

            iteration += 1
            batch = ready[:self.config.max_parallel]

            for task in batch:
                # Start task
                self.orchestrator.start_task(task)
                if self.config.on_task_start:
                    self.config.on_task_start(task)

                # Get agent
                agent = self.agents.get(task.agent_type)
                if not agent or not agent.is_available():
                    # Fall back to dry run
                    agent = DryRunAgent()

                # Build output directory for this task
                task_output = str(Path(self.config.output_dir) / "tasks" / task.task_id)

                # Build context
                context = {
                    "task_id": task.task_id,
                    "agent_type": task.agent_type.value,
                    "asset_name": task.name.replace(" ", "_").lower(),
                }

                # Generate prompt
                prompt = self.orchestrator.generate_agent_prompt(task)

                # Dispatch to agent
                try:
                    result = agent.dispatch(prompt, task_output, context)
                    self.results.append(result)

                    if result.success:
                        self.orchestrator.complete_task(task, task_output)
                        completed += 1
                        if self.config.on_task_complete:
                            self.config.on_task_complete(task, result)
                    else:
                        self.orchestrator.fail_task(task, result.error)
                        failed += 1
                        if self.config.on_task_fail:
                            self.config.on_task_fail(task, result)

                except Exception as e:
                    self.orchestrator.fail_task(task, str(e))
                    failed += 1
                    if self.config.on_task_fail:
                        self.config.on_task_fail(task, TaskResult(success=False, task_id=task.task_id, error=str(e)))

                # Progress callback
                if self.config.on_progress:
                    self.config.on_progress(completed + failed, total, task)

        elapsed = time.time() - self.start_time

        # Generate final report
        report = self.orchestrator.generate_execution_report()
        report["elapsed_seconds"] = round(elapsed, 1)
        report["iterations"] = iteration
        report["output_dir"] = self.config.output_dir

        # Save build plan
        plan_path = Path(self.config.output_dir) / "build_plan.json"
        plan_path.parent.mkdir(parents=True, exist_ok=True)
        self.orchestrator.save_plan(str(plan_path))

        # Save results
        results_path = Path(self.config.output_dir) / "build_results.json"
        results_data = [
            {
                "task_id": r.task_id,
                "success": r.success,
                "output_files": r.output_files,
                "error": r.error,
                "metadata": r.metadata,
            }
            for r in self.results
        ]
        results_path.write_text(json.dumps(results_data, indent=2))

        return report

    def get_generated_files(self) -> dict[str, list[str]]:
        """Get all generated files grouped by agent type."""
        files_by_type: dict[str, list[str]] = {}
        for result in self.results:
            if result.success and result.output_files:
                # Find the task to get agent type
                task = next((t for t in self.plan.tasks if t.task_id == result.task_id), None)
                if task:
                    agent_type = task.agent_type.value
                    files_by_type.setdefault(agent_type, []).extend(result.output_files)
        return files_by_type
