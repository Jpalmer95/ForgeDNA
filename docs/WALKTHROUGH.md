# ForgeDNA End-to-End Walkthrough

## From Game Idea to Playable Game with AI Agents

This document walks you through the complete ForgeDNA pipeline -- from a game idea written as JSON, through AI agent decomposition and generation, to a playable Godot 4.x project. Every command is copy-paste ready.

---

## Overview

The ForgeDNA pipeline turns a single JSON file into a complete game:

```
    GAME IDEA
        |
        v
  game_dna.json          <-- You describe your game (or use a template)
        |
        v
  CLI validates           <-- forgedna validate confirms schema correctness
        |
        v
  Harness decomposes      <-- broken into 24-84+ parallelizable tasks
        |
        v
  Agents generate         <-- 17 specialized AI agents build assets + code
        |
        v
  Engine assembles        <-- Godot adapter wires everything into scenes
        |
        v
  PLAY                    <-- open in Godot 4.x and play
```

Each stage is independently usable. You can write schemas by hand, browse the Community Hub for inspiration, or go straight from schema to build with a single command.

---

## Prerequisites

- **Python 3.10+** (3.12 recommended)
- **Godot 4.x** -- download from https://godotengine.org/download
- **Optional:** Claude Code, Codex, or any CLI agent for code generation
- **Optional:** HuggingFace token (`HF_TOKEN`) for image/audio asset generation

---

## Step 1: Install ForgeDNA Tools

ForgeDNA has two packages: the CLI tool (`forgedna`) and the Substrate Harness (`forgedna-harness`).

```bash
# Clone the repo (if you haven't already)
git clone https://github.com/nousresearch/ForgeDNA.git
cd ForgeDNA

# Install the CLI
cd cli
pip install -e .
cd ..

# Install the Harness
cd harness
pip install -e .
cd ..

# Verify both commands work
forgedna --help
forgedna-harness --help
```

You should see a list of commands for each tool:

```
forgedna:
  validate    Validate a game DNA file against the schema
  init        Create new game_dna.json from a template
  remix       Fork a DNA file with lineage metadata
  info        Show summary statistics
  diff        Compare two DNA files
  list-templates
  export      Export as markdown summary or AI agent prompt

forgedna-harness:
  parse       Parse and show DNA structure summary
  plan        Generate build plan (task DAG)
  stat        Detailed content inventory + build estimate
  dry-run     Simulate full pipeline without generating
  build       Run actual build with agent executors
  build-full  Full pipeline: DNA -> Tasks -> Agents -> Engine Project -> Playable Game
  serve       Start the MCP server for agent-driven game building
  agents      List all available agent types
  prompt      Generate an agent prompt for a specific task
```

---

## Step 2: Create Your Game DNA

The `game_dna.json` file is the blueprint for your entire game. It is engine-agnostic and describes everything: genre, mechanics, world, entities, assets, logic, and UI.

### Option A: Start from a Template

```bash
# List available templates
forgedna list-templates

# Create an RPG from template
forgedna init --template rpg -o my_rpg.json

# Create a platformer from template
forgedna init --template platformer -o my_platformer.json

# Create a puzzle game from template
forgedna init --template puzzle -o my_puzzle.json

# Create a minimal (bare minimum) schema
forgedna init --template minimal -o my_minimal.json
```

### Option B: Browse the Community Hub

```bash
# Run the hub locally
cd hub
pip install -r requirements.txt
python app.py
# Opens at http://localhost:7860
```

Browse, remix, and download game DNA files from the visual web interface. You can also deploy to Hugging Face Spaces for a cloud-hosted version.

### Option C: Start from an Example

The repo includes complete example schemas in the `schema/` directory. Copy one and edit it:

```bash
# Copy an RPG template to work with
cp cli/forgedna/templates/rpg.json my_game.json

# Or start from the minimal template
cp cli/forgedna/templates/minimal.json my_game.json
```

### What Goes in game_dna.json?

Here is the high-level structure:

```
game_dna.json
  |
  +-- meta              Title, genre, art_style, target_platforms, player_count
  +-- mechanics         movement, combat, crafting, progression, economy
  +-- world             environments, dungeons, procedural_generation, weather
  +-- entities          player, npcs, enemies, items, equipment
  +-- assets            models_3d, textures, animations, audio, vfx
  +-- logic             quests, world_events, skill_trees, crafting_recipes
  +-- ui                hud_elements, menus, accessibility, color_palette
```

Required sections: `meta`, `mechanics`, `world`, `entities`.
Optional sections: `assets`, `logic`, `ui`.

Example of a minimal game_dna.json:

```json
{
  "meta": {
    "title": "My First Game",
    "version": "1.0.0",
    "genre": ["rpg"],
    "art_style": "pixel_art_2d",
    "target_platforms": ["pc"],
    "player_count": {"min": 1, "max": 1}
  },
  "mechanics": {
    "movement": {
      "types": ["walk", "run", "jump"],
      "physics": "top_down"
    },
    "combat": {
      "system": "real_time",
      "damage_types": ["physical_slash", "fire"]
    }
  },
  "world": {
    "environments": [
      {
        "name": "Forest",
        "type": "outdoor",
        "atmosphere": "peaceful",
        "size": "medium"
      }
    ]
  },
  "entities": {
    "player": {
      "name": "Hero",
      "visual_description": "A small adventurer in a blue cloak",
      "stats": {"health": 100, "mana": 50, "speed": 300}
    },
    "enemies": [
      {
        "name": "Slime",
        "type": "slime",
        "behavior": "passive",
        "element": "nature",
        "stats": {"health": 30, "damage": 5}
      }
    ]
  }
}
```

Supported genres: rpg, action, adventure, platformer, puzzle, strategy, simulation, survival, roguelike, fps, horror, racing, sandbox, tower_defense, metroidvania, soulslike, and more.

Supported art styles: realistic, stylized, pixel_art_2d, low_poly, cel_shaded, hand_painted, voxel, retro_16bit, minimalist, watercolor, anime, and more.

---

## Step 3: Validate Your DNA

Before building, always validate. The validator checks your JSON against the formal schema and reports errors with specific paths.

```bash
# Validate your game
forgedna validate my_game.json

# Get a content summary
forgedna info my_game.json
```

The `info` command shows counts of everything in your schema:

```
GameDNA Statistics: My First Game
+---------------------+-----+
| Category            |   # |
+---------------------+-----+
| Environments        |   1 |
| Enemies             |   1 |
| Models 3D           |   0 |
| Textures            |   0 |
| Music Tracks        |   0 |
| SFX                 |   0 |
| ...                 | ... |
+---------------------+-----+
```

---

## Step 4: Plan the Build

Before executing anything, inspect what the harness plans to do.

```bash
# Generate a build plan and see task breakdown
forgedna-harness plan my_game.json

# Detailed view with task tree
forgedna-harness plan my_game.json -v

# Save the plan to a file
forgedna-harness plan my_game.json -o my_plan.json

# Content inventory with build estimates
forgedna-harness stat my_game.json
```

The plan shows:
- **Total tasks** generated from your DNA
- **Tasks grouped by agent type** (texture, audio_music, code_player, etc.)
- **Build phases** showing dependency order
- **Parallelism analysis** -- how many tasks can run simultaneously

### Dry Run: See the Pipeline Without Generating Anything

```bash
# Simulate the full build pipeline
forgedna-harness dry-run my_game.json

# With a custom output directory
forgedna-harness dry-run my_game.json -d ./my_dry_run_output
```

The dry run shows each iteration of the orchestration loop, listing which tasks are ready, which agent type handles them, and what gets completed. This is the fastest way to understand what a full build would do.

---

## Step 5: Build Your Game

### Option A: Dry Run Build (No Agents Needed)

The simplest option. Generates placeholder files and the Godot project scaffold. Great for testing the pipeline:

```bash
forgedna-harness build-full my_game.json -o ./my_game_build
```

### Option B: With Claude Code as Your Code Agent

If you have Claude Code installed, use it to generate actual game code:

```bash
forgedna-harness build-full my_game.json -o ./my_game_build --claude
```

Claude Code receives detailed prompts for each task -- player controller scripts, combat systems, enemy AI, quest logic, UI code -- and writes production-ready GDScript files.

### Option C: With an LLM API (OpenAI/Anthropic)

Call APIs directly for code generation:

```bash
export OPENAI_API_KEY=sk-...

forgedna-harness build-full my_game.json -o ./my_game_build \
  --api-provider openai \
  --api-model gpt-4o \
  --api-key-env OPENAI_API_KEY
```

For Anthropic:

```bash
export ANTHROPIC_API_KEY=sk-ant-...

forgedna-harness build-full my_game.json -o ./my_game_build \
  --api-provider anthropic \
  --api-model claude-sonnet-4-20250514 \
  --api-key-env ANTHROPIC_API_KEY
```

### Option D: MCP Server (Hermes Agent, Claude Code, Any MCP Client)

The MCP server lets any MCP-compatible agent drive the build:

```bash
# Terminal 1: Start the MCP server
forgedna-harness serve --port 8080 --dna my_game.json

# Terminal 2: Connect your agent
```

The MCP server exposes these tools:

| Tool                    | Description                                                   |
|-------------------------|---------------------------------------------------------------|
| `parse_game_dna`        | Parse a game_dna.json and return structure summary            |
| `generate_build_plan`   | Decompose DNA into task DAG with dependencies                 |
| `get_next_tasks`        | Get tasks ready to execute (dependencies satisfied)           |
| `get_task_prompt`       | Get the full agent prompt for a specific task                 |
| `start_task`            | Mark a task as running                                        |
| `complete_task`         | Mark task completed -- unblocks dependent tasks               |
| `fail_task`             | Mark task as failed with error details                        |
| `get_build_status`      | Get current build progress                                    |
| `get_asset_spec`        | Get detailed asset specification for AI generation            |
| `list_agent_types`      | List all available agent types and capabilities               |

To connect Hermes Agent, add the MCP endpoint in your config:

```
hermes setup tools
# Then add forge-substrate SSE endpoint: http://localhost:8080/sse
```

For Claude Code, add to your MCP server configuration:

```json
{
  "mcpServers": {
    "forge-substrate": {
      "url": "http://localhost:8080/sse"
    }
  }
}
```

---

## Step 6: Open in Godot

After `build-full` completes, a Godot project is waiting in the output directory:

```bash
# Open the generated project in Godot
godot --path ./my_game_build/godot_project
```

The generated project includes:
- `project.godot` -- full engine configuration (window size, input mapping, autoloads, physics layers)
- `scenes/main.tscn` -- main scene with player, camera, and HUD
- `scripts/player.gd` -- player controller with movement types from your DNA
- `scripts/combat_system.gd` -- elemental damage, status effects, health management
- `scripts/glyph_system.gd` -- glyph attunement (if your DNA includes custom mechanics)
- `scripts/quest_system.gd` -- quest tracking and objective management
- `scripts/audio_manager.gd` -- music and SFX management
- `scripts/hud.gd` + `scenes/hud.tscn` -- HUD overlay
- Per-enemy scripts (one for each enemy defined in your DNA)
- Environment scenes (one for each environment in your world)

---

## Full Example: Building with Quiet Hollow

Let us walk through a complete build using the puzzle template (since the Quiet Hollow example represents a cozy puzzle-adventure).

### Step 1: Create the DNA

```bash
cd ~/ForgeDNA

# Create from puzzle template
forgedna init --template puzzle -o quiet_hollow.json
```

Edit `quiet_hollow.json` to describe a cozy hand-painted puzzle-adventure about restoring a garden. Key sections would include:

- **meta:** genre=puzzle, art_style=hand_painted
- **mechanics:** movement with walk/dash, no combat, puzzle-solving
- **world:** garden environments (Overgrown Path, Sunlit Clearing, Hidden Grotto)
- **entities:** player gardener, no enemies, interactive flora
- **assets:** 3D models for plants, textures for garden surfaces, ambient audio

### Step 2: Validate and Plan

```bash
# Validate
forgedna validate quiet_hollow.json

# See what the harness sees
forgedna-harness parse quiet_hollow.json

# Generate build plan
forgedna-harness plan quiet_hollow.json -v

# Get full inventory
forgedna-harness stat quiet_hollow.json
```

### Step 3: Dry Run to Verify

```bash
# Simulate the full pipeline
forgedna-harness dry-run quiet_hollow.json
```

Output shows each iteration:

```
Iteration 1: 1 tasks ready
  -> Project Scaffolding [Assembly]

Iteration 2: 5 tasks ready
  -> Generate Player Controller [Player Controller Agent]
  -> Generate Texture: garden_grass [Texture Generator]
  -> Generate Music: ambient_garden [Music Generator]
  -> Generate SFX: water_splash [SFX Generator]
  -> Generate Ambient: forest_birds [Ambient Audio Generator]
...
```

### Step 4: What Each Agent Receives

Each task generates a detailed prompt. Here is what the Player Controller agent receives:

```
## Task: Generate Player Controller
Generate the player controller script for "Quiet Hollow".

## Input Data
{
  "movement_types": ["walk", "run", "dash"],
  "physics": "top_down",
  "abilities": ["interact", "plant_seed", "water"],
  "stats": {"health": 100, "speed": 300}
}

## Requirements
- Generate complete, production-ready GDScript code
- Include all movement types from the DNA
- Add interact ability for puzzle elements
- Follow Godot 4.x best practices
```

And what a Texture agent receives:

```
Generate a seamless tileable PBR texture: "Soft garden grass with small wildflowers".
Style: hand-painted, warm colors, soft edges. 4K resolution, clean edges.
```

### Step 5: Full Build

```bash
# With Claude Code
forgedna-harness build-full quiet_hollow.json -o ./qh_build --claude

# Or with API
export OPENAI_API_KEY=sk-...
forgedna-harness build-full quiet_hollow.json -o ./qh_build \
  --api-provider openai --api-model gpt-4o --api-key-env OPENAI_API_KEY
```

### Step 6: Play

```bash
godot --path ./qh_build/godot_project
```

---

## Architecture Deep Dive

### The Pipeline Flow (Detailed)

```
game_dna.json
    |
    v
[DNA Parser] ---------> GameDNA object with typed accessors
    |                     .title, .genre, .art_style
    |                     .environments(), .enemies(), .quests()
    |                     .models_3d(), .textures(), .audio_music()
    v
[Task Decomposer] -----> BuildPlan with DAG of BuildTask objects
    |                     Each task has: task_id, agent_type, name,
    |                     description, input_data, dependencies, status
    v
[BuildManager] --------> Orchestrator iterates the DAG:
    |                     1. Get ready tasks (deps all completed)
    |                     2. Dispatch batch to agents (up to max_parallel)
    |                     3. Collect TaskResult (success, output_files, error)
    |                     4. Mark complete/failed -> unblock dependents
    |                     5. Repeat until all tasks done
    v
[Engine Adapter] ------> GodotAdapter generates project files:
    |                     project.godot, scenes, scripts, directory structure
    v
[Output] --------------> Playable Godot project ready to open
```

### Agent Types (17 Total)

```
ASSET AGENTS (highly parallelizable)
  asset_3d          3D Asset Generator      - 3D meshes via TripoSR, InstantMesh
  texture           Texture Generator       - PBR textures via Stable Diffusion XL
  animation         Animation Generator     - Skeletal animations from text
  vfx               VFX Generator           - Shaders, particles, post-processing

AUDIO AGENTS (parallelizable)
  audio_music       Music Generator         - Background music, themes (musicgen-medium)
  audio_sfx         SFX Generator           - Sound effects (musicgen-small)
  audio_ambient     Ambient Generator       - Environmental soundscapes (audioldm-2)
  audio_voice       Voice Generator         - NPC voices (xtts-v2, bark)

CODE AGENTS
  code_player       Player Controller       - Movement, abilities, glyph systems
  code_enemy        Enemy AI                - Behavior trees, attack patterns
  code_combat       Combat System           - Damage calc, status effects, elemental reactions
  code_quest        Quest System            - Quest logic, dialogue trees, objectives
  code_crafting     Crafting System         - Recipes, gathering, economy
  code_ui           UI Agent                - HUD, menus, inventory screens
  code_world        World Building          - Levels, scenes, day-night, weather

PIPELINE AGENTS
  assembly          Assembly Agent          - Integrates all assets into engine project
  test              Test Agent              - Validates compilation, no crashes
```

### Agent Backends (How Tasks Are Dispatched)

The `AgentProtocol` abstract class defines the dispatch interface. Five concrete backends:

```
SubprocessAgent    Spawns CLI agents (Claude Code, Codex, custom scripts)
                    - Writes task prompt to stdin
                    - Captures stdout/stderr
                    - Snapshots output directory for new files

APIAgent           Calls LLM APIs directly (OpenAI, Anthropic, generic)
                    - Sends prompt to chat completion endpoint
                    - Extracts code blocks from markdown response
                    - Writes extracted code as files

HFAgent            Uses HuggingFace models for asset generation
                    - text-to-image: Stable Diffusion XL for textures
                    - text-to-audio: musicgen, audioldm for audio

MCPAgent           Connects to MCP servers
                    - Calls remote tools via HTTP
                    - Collects output files and metadata

DryRunAgent        Simulation mode (no actual generation)
                    - Creates placeholder files
                    - Used for testing and dry runs
```

### The BuildManager Orchestration Loop

The `BuildManager` class in `harness/agents/build_manager.py` drives the entire pipeline:

1. **Parse DNA** -- loads `game_dna.json` into a `GameDNA` object
2. **Decompose** -- the `decompose()` function creates a `BuildPlan` DAG
3. **Init agents** -- creates agent instances based on `BuildConfig`
4. **Execute loop:**
   - `orchestrator.get_ready_tasks()` returns tasks whose dependencies are all completed
   - Take up to `max_parallel` tasks from the ready batch
   - For each task:
     - `orchestrator.start_task(task)` marks it running
     - `orchestrator.generate_agent_prompt(task)` creates the agent prompt
     - `agent.dispatch(prompt, output_dir, context)` sends to the agent
     - On success: `orchestrator.complete_task(task, output_path)` unblocks dependents
     - On failure: `orchestrator.fail_task(task, error)` marks failed
   - Repeat until no more ready tasks
5. **Generate report** -- completion stats, elapsed time, iteration count
6. **Save artifacts** -- `build_plan.json` and `build_results.json` to output directory

### The Godot Adapter

The `GodotAdapter` in `harness/engine_adapters/godot.py` generates a complete Godot 4.x project:

```
godot_project/
  project.godot              Configuration (window, input, autoloads, physics)
  scenes/
    main.tscn                Main scene with player + HUD
    env_<name>.tscn          One per environment in your world
  scripts/
    player.gd                Player controller (movement from DNA)
    combat_system.gd         Autoload: damage, elements, status effects
    glyph_system.gd          Autoload: glyph attunement, resonance combos
    quest_system.gd          Autoload: quest tracking, objectives
    audio_manager.gd         Autoload: music/SFX management
    hud.gd                   HUD overlay script
    enemy_<name>.gd          Per-enemy AI scripts
  assets/
    textures/                Generated texture files
    audio/
      music/                 Generated music tracks
      sfx/                   Generated sound effects
      ambient/               Generated ambient loops
    models/                  Generated 3D model files
```

Key autoloads are registered in `project.godot`:
- `CombatSystem` -- elemental damage calculation, status effects
- `GlyphSystem` -- glyph equipping, deep attunement, resonance combos
- `QuestSystem` -- quest state, dialogue, objectives
- `AudioManager` -- music playback, SFX triggers

---

## Extending ForgeDNA

### Adding a New Agent Type

1. **Add to the `AgentType` enum** in `harness/harness/agent_specs.py`:

```python
class AgentType(str, Enum):
    # ... existing types ...
    CODE_DIALOGUE = "code_dialogue"  # New type
```

2. **Register the spec** in `AGENT_REGISTRY`:

```python
AgentType.CODE_DIALOGUE: AgentSpec(
    agent_type=AgentType.CODE_DIALOGUE,
    name="Dialogue System Agent",
    description="Generates branching dialogue trees and NPC conversation logic.",
    tools_required=["code_generation", "filesystem"],
    models_required=["qwen-2.5-72b-instruct"],
    can_parallelize=True,
    max_instances=2,
),
```

3. **Create an executor** in `harness/harness/executors.py`:

```python
class DialogueCodeExecutor(CodeExecutor):
    def execute(self, task: BuildTask) -> dict[str, Any]:
        system_ctx = "You are an expert dialogue system programmer..."
        prompt = self._generate_prompt(task, system_ctx)
        out_path = self.output_dir / "code" / "dialogue" / f"{task.task_id}.gd"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        return {
            "success": True,
            "task_id": task.task_id,
            "output_path": str(out_path),
            "generation_prompt": prompt,
            "model": "qwen-2.5-72b-instruct",
            "type": "code",
        }
```

4. **Register the executor** in `EXECUTOR_REGISTRY`:

```python
EXECUTOR_REGISTRY: dict[AgentType, type[AgentExecutor]] = {
    # ... existing entries ...
    AgentType.CODE_DIALOGUE: DialogueCodeExecutor,
}
```

5. **Wire into the task decomposer** -- update `decompose()` in `harness/harness/task_decomposer.py` to create tasks for your new agent type based on DNA content.

### Adding a New Engine Adapter

The engine adapter system is pluggable. To add Unity, Unreal, or a custom engine:

1. **Create a new adapter file** at `harness/harness/engine_adapters/unity.py`:

```python
from ..dna_parser import GameDNA

class UnityAdapter:
    def __init__(self, dna: GameDNA, output_dir: str):
        self.dna = dna
        self.output_dir = Path(output_dir)

    def generate_all(self) -> dict[str, Any]:
        # Generate Unity project files
        # C# scripts, prefabs, scenes, etc.
        return {
            "engine": "unity",
            "project_dir": str(self.project_dir),
            "files_created": [...],
            "total_files": len(...),
        }
```

2. **Register it** in `harness/harness/engine_adapters/__init__.py`:

```python
from .godot import GodotAdapter
from .unity import UnityAdapter

ENGINES = {
    "godot": GodotAdapter,
    "unity": UnityAdapter,  # New engine
}
```

3. **Use it:**

```bash
forgedna-harness build-full my_game.json -o ./build --engine unity
```

### Adding Custom Skills via MCP

The MCP server and agent protocol are designed for extensibility. Any MCP-compatible tool can be plugged in:

1. Write a tool that implements the task execution interface
2. Expose it as an MCP server
3. Configure the harness to dispatch to it via `MCPAgent` backend

No source code changes needed -- just configuration.

---

## Troubleshooting

### "GameDNA file not found"

Make sure the path to your JSON file is correct. Use absolute paths if unsure:

```bash
forgedna validate /full/path/to/my_game.json
```

### "Schema validation failed"

Run `forgedna validate` and read the error message carefully. Common issues:
- Missing required section (`meta`, `mechanics`, `world`, `entities`)
- Wrong data type (string where array expected, etc.)
- Invalid genre or art_style value (must be from the supported list)

### "No tasks ready" during dry-run or build

This means a dependency loop or failed dependency is blocking all remaining tasks. Run with verbose output:

```bash
forgedna-harness plan my_game.json -v
```

Check that task dependencies form a valid DAG (no cycles).

### "Agent not available" / fallback to DryRun

Each agent backend checks availability:
- **SubprocessAgent:** checks if the CLI command exists on PATH
- **APIAgent:** checks if the API key env var is set
- **HFAgent:** checks if HF_TOKEN is set
- **MCPAgent:** checks if the MCP server responds

If an agent is unavailable, the harness falls back to `DryRunAgent` (placeholder files). Install the missing tool or set the missing env var.

### Godot project does not open

- Ensure you have **Godot 4.x** (not 3.x -- the generated project uses Godot 4.x format)
- Check that `project.godot` exists in the output directory
- Try opening from the Godot project manager rather than command line

### Claude Code not found

```bash
# Install Claude Code
npm install -g @anthropic-ai/claude-code

# Verify
claude --version
```

### HF token issues for asset generation

```bash
# Set your HuggingFace token
export HF_TOKEN=hf_your_token_here

# Verify
echo $HF_TOKEN
```

### Permission denied on output directory

```bash
# Make sure the output directory is writable
mkdir -p ./my_game_build
chmod 755 ./my_game_build
```

---

## Quick Reference

```bash
# Full workflow in 6 commands
forgedna init --template rpg -o my_game.json     # 1. Create DNA
forgedna validate my_game.json                    # 2. Validate
forgedna-harness plan my_game.json -v             # 3. Plan
forgedna-harness dry-run my_game.json             # 4. Dry run
forgedna-harness build-full my_game.json -o ./build --claude  # 5. Build
godot --path ./build/godot_project                # 6. Play
```

```bash
# With MCP server (for agent-driven builds)
forgedna-harness serve --port 8080 --dna my_game.json

# With API
export OPENAI_API_KEY=sk-...
forgedna-harness build-full my_game.json -o ./build \
  --api-provider openai --api-model gpt-4o --api-key-env OPENAI_API_KEY

# Compare two game designs
forgedna diff game_v1.json game_v2.json

# Export as AI agent prompt
forgedna export -f prompt my_game.json > build_prompt.txt

# List all agent capabilities
forgedna-harness agents

# Generate a prompt for a specific task
forgedna-harness prompt my_game.json my_task_id
```

---

## What Comes Next

After your first build:

- **Iterate** -- edit the `game_dna.json` and rebuild. The `forgedna diff` command helps you see what changed.
- **Share** -- upload your DNA to the Community Hub for others to remix.
- **Remix** -- `forgedna remix cool_game.json -o my_version.json` preserves lineage.
- **Extend** -- add new agent types, engine adapters, or MCP tools.
- **Export for production** -- use Godot's export presets to build for PC, mobile, or web.

ForgeDNA is designed to be composable. Use the CLI alone, the harness alone, the MCP server alone, or the full pipeline. The JSON schema is the source of truth -- everything else is an agent reading from it.
