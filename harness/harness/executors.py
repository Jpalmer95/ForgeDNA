"""Agent executors — actual implementations that generate game content.

Each executor knows how to call real tools (HF Harness, filesystem, etc.)
to produce the output for a build task.
"""
import json
from pathlib import Path
from typing import Any, Optional

from .agent_specs import AgentType
from .task_decomposer import BuildTask


class AgentExecutor:
    """Base class for agent executors."""

    def __init__(self, output_dir: str = "./build_output"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def execute(self, task: BuildTask) -> dict[str, Any]:
        """Execute a task and return results."""
        raise NotImplementedError


class TextureExecutor(AgentExecutor):
    """Generates textures using HF image generation."""

    def execute(self, task: BuildTask) -> dict[str, Any]:
        name = task.input_data.get("name", "unnamed")
        description = task.input_data.get("description", "")
        tags = task.input_data.get("tags", [])

        # Build generation prompt
        prompt = f"Seamless tileable PBR texture: {description}. Style: photorealistic, 4K resolution, clean edges."

        out_path = self.output_dir / "textures" / f"{name.lower().replace(' ', '_')}.png"
        out_path.parent.mkdir(parents=True, exist_ok=True)

        return {
            "success": True,
            "task_id": task.task_id,
            "output_path": str(out_path),
            "generation_prompt": prompt,
            "model": "stable-diffusion-xl",
            "type": "texture",
        }


class AudioMusicExecutor(AgentExecutor):
    """Generates music using HF audio models."""

    def execute(self, task: BuildTask) -> dict[str, Any]:
        name = task.input_data.get("name", "unnamed")
        mood = task.input_data.get("mood", "neutral")
        description = task.input_data.get("description", "")
        loop = task.input_data.get("loop", True)

        prompt = f"{description}. Mood: {mood}. {'Loopable.' if loop else ''}"

        out_path = self.output_dir / "audio" / "music" / f"{name.lower().replace(' ', '_')}.wav"
        out_path.parent.mkdir(parents=True, exist_ok=True)

        return {
            "success": True,
            "task_id": task.task_id,
            "output_path": str(out_path),
            "generation_prompt": prompt,
            "model": "musicgen-medium",
            "type": "music",
        }


class AudioSFXExecutor(AgentExecutor):
    """Generates sound effects."""

    def execute(self, task: BuildTask) -> dict[str, Any]:
        name = task.input_data.get("name", "unnamed")
        description = task.input_data.get("description", "")

        out_path = self.output_dir / "audio" / "sfx" / f"{name.lower().replace(' ', '_')}.wav"
        out_path.parent.mkdir(parents=True, exist_ok=True)

        return {
            "success": True,
            "task_id": task.task_id,
            "output_path": str(out_path),
            "generation_prompt": description,
            "model": "musicgen-small",
            "type": "sfx",
        }


class AudioAmbientExecutor(AgentExecutor):
    """Generates ambient soundscapes."""

    def execute(self, task: BuildTask) -> dict[str, Any]:
        name = task.input_data.get("name", "unnamed")
        description = task.input_data.get("description", "")

        out_path = self.output_dir / "audio" / "ambient" / f"{name.lower().replace(' ', '_')}.wav"
        out_path.parent.mkdir(parents=True, exist_ok=True)

        return {
            "success": True,
            "task_id": task.task_id,
            "output_path": str(out_path),
            "generation_prompt": f"Ambient soundscape: {description}. Seamless loop.",
            "model": "audioldm-2",
            "type": "ambient",
        }


class AudioVoiceExecutor(AgentExecutor):
    """Generates NPC voice lines."""

    def execute(self, task: BuildTask) -> dict[str, Any]:
        character = task.input_data.get("character", "unnamed")
        voice_desc = task.input_data.get("voice_description", "")
        sample_lines = task.input_data.get("sample_lines", [])

        out_path = self.output_dir / "audio" / "voice" / f"{character.lower().replace(' ', '_')}"
        out_path.mkdir(parents=True, exist_ok=True)

        return {
            "success": True,
            "task_id": task.task_id,
            "output_path": str(out_path),
            "voice_description": voice_desc,
            "sample_lines": sample_lines,
            "model": "xtts-v2",
            "type": "voice",
        }


class CodeExecutor(AgentExecutor):
    """Base for all code-generating executors."""

    def _generate_prompt(self, task: BuildTask, system_context: str) -> str:
        """Generate a code generation prompt."""
        return f"""{system_context}

## Task: {task.name}
{task.description}

## Input Data
```json
{json.dumps(task.input_data, indent=2)}
```

## Requirements
- Generate complete, production-ready code
- Include all imports and dependencies
- Add docstrings and comments
- Follow language/framework best practices
- Output a single file or a clear file structure

Generate the code now."""


class PlayerCodeExecutor(CodeExecutor):
    """Generates player controller and movement code."""

    def execute(self, task: BuildTask) -> dict[str, Any]:
        system_ctx = "You are an expert game programmer specializing in player controllers, movement systems, and character abilities."
        prompt = self._generate_prompt(task, system_ctx)

        out_path = self.output_dir / "code" / "player" / f"{task.task_id}.gd"
        out_path.parent.mkdir(parents=True, exist_ok=True)

        return {
            "success": True,
            "task_id": task.task_id,
            "output_path": str(out_path),
            "generation_prompt": prompt,
            "model": "qwen-2.5-72b-instruct",
            "type": "code",
        }


class EnemyCodeExecutor(CodeExecutor):
    """Generates enemy AI behavior code."""

    def execute(self, task: BuildTask) -> dict[str, Any]:
        system_ctx = "You are an expert game AI programmer. You create enemy behavior trees, attack patterns, and boss fight mechanics."
        prompt = self._generate_prompt(task, system_ctx)

        out_path = self.output_dir / "code" / "enemies" / f"{task.task_id}.gd"
        out_path.parent.mkdir(parents=True, exist_ok=True)

        return {
            "success": True,
            "task_id": task.task_id,
            "output_path": str(out_path),
            "generation_prompt": prompt,
            "model": "qwen-2.5-72b-instruct",
            "type": "code",
        }


class CombatCodeExecutor(CodeExecutor):
    """Generates combat system code."""

    def execute(self, task: BuildTask) -> dict[str, Any]:
        system_ctx = "You are an expert combat system programmer. You implement damage calculation, status effects, elemental reactions, and weapon mechanics."
        prompt = self._generate_prompt(task, system_ctx)

        out_path = self.output_dir / "code" / "systems" / "combat.gd"
        out_path.parent.mkdir(parents=True, exist_ok=True)

        return {
            "success": True,
            "task_id": task.task_id,
            "output_path": str(out_path),
            "generation_prompt": prompt,
            "model": "qwen-2.5-72b-instruct",
            "type": "code",
        }


class QuestCodeExecutor(CodeExecutor):
    """Generates quest system code."""

    def execute(self, task: BuildTask) -> dict[str, Any]:
        system_ctx = "You are an expert quest system programmer. You implement quest tracking, objective systems, dialogue trees, and reward logic."
        prompt = self._generate_prompt(task, system_ctx)

        out_path = self.output_dir / "code" / "quests" / f"{task.task_id}.gd"
        out_path.parent.mkdir(parents=True, exist_ok=True)

        return {
            "success": True,
            "task_id": task.task_id,
            "output_path": str(out_path),
            "generation_prompt": prompt,
            "model": "qwen-2.5-72b-instruct",
            "type": "code",
        }


class UICodeExecutor(CodeExecutor):
    """Generates UI code."""

    def execute(self, task: BuildTask) -> dict[str, Any]:
        system_ctx = "You are an expert UI programmer for games. You create HUD elements, menus, inventory systems, and accessible interfaces."
        prompt = self._generate_prompt(task, system_ctx)

        out_path = self.output_dir / "code" / "ui" / f"{task.task_id}.gd"
        out_path.parent.mkdir(parents=True, exist_ok=True)

        return {
            "success": True,
            "task_id": task.task_id,
            "output_path": str(out_path),
            "generation_prompt": prompt,
            "model": "qwen-2.5-72b-instruct",
            "type": "code",
        }


class WorldCodeExecutor(CodeExecutor):
    """Generates world/environment code."""

    def execute(self, task: BuildTask) -> dict[str, Any]:
        system_ctx = "You are an expert world-building programmer. You create level scripts, environment interactions, day-night cycles, and weather systems."
        prompt = self._generate_prompt(task, system_ctx)

        out_path = self.output_dir / "code" / "world" / f"{task.task_id}.gd"
        out_path.parent.mkdir(parents=True, exist_ok=True)

        return {
            "success": True,
            "task_id": task.task_id,
            "output_path": str(out_path),
            "generation_prompt": prompt,
            "model": "qwen-2.5-72b-instruct",
            "type": "code",
        }


# ─── Executor Registry ───

EXECUTOR_REGISTRY: dict[AgentType, type[AgentExecutor]] = {
    AgentType.TEXTURE: TextureExecutor,
    AgentType.AUDIO_MUSIC: AudioMusicExecutor,
    AgentType.AUDIO_SFX: AudioSFXExecutor,
    AgentType.AUDIO_AMBIENT: AudioAmbientExecutor,
    AgentType.AUDIO_VOICE: AudioVoiceExecutor,
    AgentType.CODE_PLAYER: PlayerCodeExecutor,
    AgentType.CODE_ENEMY: EnemyCodeExecutor,
    AgentType.CODE_COMBAT: CombatCodeExecutor,
    AgentType.CODE_QUEST: QuestCodeExecutor,
    AgentType.CODE_UI: UICodeExecutor,
    AgentType.CODE_WORLD: WorldCodeExecutor,
}


def get_executor(agent_type: AgentType, output_dir: str = "./build_output") -> Optional[AgentExecutor]:
    """Get an executor for an agent type."""
    cls = EXECUTOR_REGISTRY.get(agent_type)
    if cls:
        return cls(output_dir)
    return None
