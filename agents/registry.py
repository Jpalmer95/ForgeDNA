"""Agent identity registry — track who's building what.

Agents register themselves with capabilities, reputation, and identity.
This enables:
  - Agent marketplace: discover the best agent for a task
  - Provenance tracking: know which agent generated each asset
  - Reputation system: community-rated quality scores
  - Delegation: agents can find and call other agents

Registry lives in agents/registry.json by default, or in PostgreSQL
when the Hub database is configured.
"""

import json
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

REGISTRY_PATH = Path(__file__).parent / "registry.json"


@dataclass
class Agent:
    """Identity and capabilities of a single agent instance."""
    agent_id: str
    name: str
    agent_type: str  # matches AgentType enum values
    capabilities: list[str] = field(default_factory=list)
    owner: str = ""
    endpoint: str = ""  # MCP SSE URL, subprocess path, or API endpoint
    reputation_score: float = 0.0  # 0.0-5.0 community rating
    total_builds: int = 0
    avg_quality: float = 0.0  # 0.0-1.0
    avg_generation_time_seconds: float = 0.0
    tags: list[str] = field(default_factory=list)
    created_at: str = ""
    updated_at: str = ""
    metadata: dict = field(default_factory=dict)

    def __post_init__(self):
        if not self.agent_id:
            self.agent_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        if not self.created_at:
            self.created_at = now
        self.updated_at = now


class AgentRegistry:
    """Persistent registry of all known agents."""

    def __init__(self, path: str | Path | None = None):
        self.path = Path(path) if path else REGISTRY_PATH
        self._agents: dict[str, Agent] = {}
        self._load()

    def _load(self) -> None:
        if self.path.exists():
            try:
                raw = json.loads(self.path.read_text())
                for entry in raw.get("agents", []):
                    agent = Agent(**entry)
                    self._agents[agent.agent_id] = agent
            except (json.JSONDecodeError, TypeError):
                self._agents = {}

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "version": "1.0.0",
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "agent_count": len(self._agents),
            "agents": [asdict(a) for a in self._agents.values()],
        }
        self.path.write_text(json.dumps(data, indent=2) + "\n")

    def register(self, agent: Agent) -> str:
        """Register or update an agent. Returns the agent_id."""
        self._agents[agent.agent_id] = agent
        self._save()
        return agent.agent_id

    def unregister(self, agent_id: str) -> bool:
        """Remove an agent from the registry."""
        if agent_id in self._agents:
            del self._agents[agent_id]
            self._save()
            return True
        return False

    def get(self, agent_id: str) -> Optional[Agent]:
        """Get an agent by ID."""
        return self._agents.get(agent_id)

    def find_by_type(self, agent_type: str) -> list[Agent]:
        """Find all agents of a given type, sorted by reputation."""
        results = [a for a in self._agents.values() if a.agent_type == agent_type]
        return sorted(results, key=lambda a: a.reputation_score, reverse=True)

    def find_by_capability(self, capability: str) -> list[Agent]:
        """Find all agents advertising a specific capability."""
        results = [a for a in self._agents.values() if capability in a.capabilities]
        return sorted(results, key=lambda a: a.reputation_score, reverse=True)

    def list_all(self) -> list[Agent]:
        """List all registered agents."""
        return sorted(self._agents.values(), key=lambda a: a.name)

    def update_reputation(self, agent_id: str, new_score: float) -> bool:
        """Update an agent's reputation score (0-5)."""
        agent = self._agents.get(agent_id)
        if agent:
            agent.reputation_score = max(0.0, min(5.0, new_score))
            agent.updated_at = datetime.now(timezone.utc).isoformat()
            self._save()
            return True
        return False

    def record_build(self, agent_id: str, quality: float, duration_seconds: float) -> bool:
        """Record a completed build for stats tracking."""
        agent = self._agents.get(agent_id)
        if agent:
            agent.total_builds += 1
            # Rolling average
            n = agent.total_builds
            agent.avg_quality = ((agent.avg_quality * (n - 1)) + quality) / n
            agent.avg_generation_time_seconds = (
                (agent.avg_generation_time_seconds * (n - 1)) + duration_seconds
            ) / n
            agent.updated_at = datetime.now(timezone.utc).isoformat()
            self._save()
            return True
        return False

    def stats(self) -> dict:
        """Registry statistics."""
        agents = list(self._agents.values())
        by_type: dict[str, int] = {}
        for a in agents:
            by_type[a.agent_type] = by_type.get(a.agent_type, 0) + 1
        return {
            "total_agents": len(agents),
            "by_type": by_type,
            "top_reputation": sorted(agents, key=lambda a: a.reputation_score, reverse=True)[:5],
            "most_active": sorted(agents, key=lambda a: a.total_builds, reverse=True)[:5],
        }
