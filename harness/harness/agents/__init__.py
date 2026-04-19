"""Agent protocol — abstract interface for dispatching tasks to any agent type."""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Optional


class AgentBackend(str, Enum):
    """How an agent receives and executes tasks."""
    SUBPROCESS = "subprocess"   # CLI agent (Claude Code, Codex, custom script)
    API = "api"                 # Direct LLM API call (OpenAI, Anthropic, etc.)
    HF = "hf"                   # Hugging Face model inference
    MCP = "mcp"                 # MCP server endpoint
    DRY_RUN = "dry_run"         # Simulation only


@dataclass
class AgentConfig:
    """Configuration for an agent."""
    name: str
    backend: AgentBackend
    # For subprocess
    command: str = ""                   # e.g., "claude", "codex", "python agent.py"
    args_template: list[str] = field(default_factory=list)  # e.g., ["--acp", "--stdio"]
    # For API
    api_provider: str = ""              # e.g., "openai", "anthropic"
    api_model: str = ""                 # e.g., "gpt-4o", "claude-sonnet-4-20250514"
    api_key_env: str = ""               # e.g., "OPENAI_API_KEY"
    api_base_url: str = ""              # Optional custom endpoint
    # For HF
    hf_model: str = ""                  # e.g., "stabilityai/stable-diffusion-xl-base-1.0"
    hf_task: str = ""                   # e.g., "text-to-image", "text-to-audio"
    hf_token_env: str = "HF_TOKEN"
    # For MCP
    mcp_url: str = ""                   # e.g., "http://localhost:8080"
    # General
    timeout: int = 300                  # Max seconds per task
    max_retries: int = 2
    env_vars: dict[str, str] = field(default_factory=dict)


@dataclass
class TaskResult:
    """Result from an agent executing a task."""
    success: bool
    task_id: str
    output_files: list[str] = field(default_factory=list)   # Paths to generated files
    output_text: str = ""                                    # Text output (logs, summaries)
    error: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)   # Model used, tokens, etc.


class AgentProtocol(ABC):
    """Abstract protocol for dispatching tasks to agents."""

    @abstractmethod
    def dispatch(self, task_prompt: str, output_dir: str, context: dict[str, Any] = None) -> TaskResult:
        """Send a task to the agent and collect results."""
        ...

    @abstractmethod
    def is_available(self) -> bool:
        """Check if this agent backend is reachable and configured."""
        ...


def list_generated_files(directory: str) -> list[str]:
    """List all files generated in a directory (non-recursive snapshot)."""
    result = []
    base = Path(directory)
    if base.exists():
        for f in sorted(base.rglob("*")):
            if f.is_file():
                result.append(str(f.relative_to(base)))
    return result
