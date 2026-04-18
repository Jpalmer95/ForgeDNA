# ForgeDNA

A text-first game design platform for AI Agents.

## What is ForgeDNA?

ForgeDNA is an open-source ecosystem that turns lightweight JSON blueprints into fully playable games — powered by AI agents. You write a single `game_dna.json` file describing your game's mechanics, world, entities, assets, and UI. Then an orchestra of specialized AI agents takes over: generating 3D models, writing game code, composing music, building levels, and assembling everything into a playable build.

The vision is simple: anyone — game designer, hobbyist, or AI agent — can define a complete game as structured data. The ForgeDNA platform handles the rest. No game engine expertise required to get started. No lock-in to a single engine. Just describe what you want, and watch it get built.

This repository contains the complete ForgeDNA stack: a CLI tool for working with game schemas, a Community Hub for browsing and remixing, and the Substrate Harness that orchestrates 17 specialized AI agents to turn schemas into games. Everything is MCP-native, so any MCP-compatible agent (Hermes, Claude Code, LM Studio, etc.) can drive the build pipeline.

## The Full Circle Pipeline

ForgeDNA connects every stage of game creation in a full-circle flow:

```
    +---------------------------------------------------------------+
    |                     ForgeDNA Pipeline                         |
    |                                                               |
    |    (1) DESIGN                                                 |
    |    Human or AI creates game_dna.json                          |
    |    via CLI, Community Hub, or hand-coded                      |
    |         |                                                     |
    |         v                                                     |
    |    (2) SHARE                                                  |
    |    Browse, remix, and fork on the                             |
    |    Community Hub (local or HF Spaces)                         |
    |         |                                                     |
    |         v                                                     |
    |    (3) BUILD                                                  |
    |    Substrate Harness decomposes into tasks,                   |
    |    dispatches to 17 specialized agent types                   |
    |         |                                                     |
    |         v                                                     |
    |    (4) CREATE                                                 |
    |    Agents generate 3D models, textures,                       |
    |    audio, code, UI elements                                   |
    |         |                                                     |
    |         v                                                     |
    |    (5) ASSEMBLE                                               |
    |    Everything wired together into a                           |
    |    playable engine project (Godot, etc.)                      |
    |         |                                                     |
    |         v                                                     |
    |    (6) PLAY                                                   |
    |    Export and share globally (.apk, .exe, HTML5)              |
    |         |                                                     |
    |         +--------------------> (loop back to Share/Remix)     |
    +---------------------------------------------------------------+
```

Each stage is independently usable. You can write schemas by hand, browse the hub for inspiration, or go straight from schema to build. The pipeline is composable — use what you need, skip what you don't.

## Quick Start

### Local Machine (Docker)

**Prerequisites:** Python 3.10+, Docker, git

```bash
# Clone the repo
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

# Run the Community Hub
cd hub
pip install -r requirements.txt
python app.py
# Opens at http://localhost:7860

# In a separate terminal — start the MCP substrate server
docker build -t forge-substrate -f Schema-Builder/artifacts/forge-substrate/Dockerfile.godot .
docker run -p 8080:8080 -d forge-substrate
```

### HF Spaces (Cloud)

Deploy the Community Hub to Hugging Face Spaces with zero local GPU required:

```bash
# 1. Fork the template Space on Hugging Face
# 2. Set these secrets in your Space settings:
#    - HF_TOKEN (for persistent storage)
#    - FORGEDNA_HUB_REPO (your HF dataset repo for storage)

# The Space auto-deploys with:
# - Browse and filter game DNA files
# - Visual JSON editor with live validation
# - Remix any DNA file with one click
# - Upload/download game_dna.json files
```

### With Existing Agents

ForgeDNA's Substrate Harness exposes an MCP server, so any MCP-compatible agent can drive the build pipeline.

**Hermes Agent:**
```
# In your Hermes config, add MCP server:
hermes setup tools
# Then add forge-substrate SSE endpoint: http://localhost:8080/sse
```

**Claude Code:**
```
# Add to your MCP server configuration:
{
  "mcpServers": {
    "forge-substrate": {
      "url": "http://localhost:8080/sse"
    }
  }
}
```

**LM Studio:**
```
# Add a new SSE Server connection:
# URL: http://localhost:8080/sse
```

**Any MCP-compatible agent:** Connect to `http://localhost:8080/sse` and the agent gets access to schema ingestion, workspace commands, file I/O, and game export tools.

### Build Your First Game

```bash
# 1. Create a new game DNA from a template
forgedna init --template rpg -o my_game.json

# 2. Validate it
forgedna validate my_game.json

# 3. Preview the build plan
forgedna-harness plan my_game.json

# 4. Dry-run the full pipeline (no actual generation)
forgedna-harness dry-run my_game.json

# 5. Or prompt your connected AI agent:
# "Ingest this game schema and build it: [paste game_dna.json]"
```

## The GameDNA Schema

The heart of ForgeDNA is the `game_dna.json` schema — a universal, engine-agnostic JSON format (JSON Schema draft-07) for defining complete game designs. It captures everything an AI agent needs to generate a playable game.

**Required sections:** `meta`, `mechanics`, `world`, `entities`
**Optional sections:** `assets`, `logic`, `ui`

```
game_dna.json
  |
  +-- meta          Title, genre, art style, platforms, player count
  +-- mechanics     Movement, combat, crafting, progression, economy
  +-- world         Environments, dungeons, procedural generation, weather
  +-- entities      Player, NPCs, enemies, items, equipment
  +-- assets        AI-generation-ready descriptions for 3D models, textures, audio, VFX
  +-- logic         Quests, world events, skill trees, crafting recipes
  +-- ui            HUD layout, menus, accessibility, color palette
```

**Validate a schema file:**
```bash
forgedna validate my_game.json
```

**Schema location:** `schema/game_dna.schema.json`
**Schema version:** 1.0.0 (draft-07 compatible)

**Supported genres:** rpg, mmorpg, action, adventure, platformer, puzzle, strategy, simulation, survival, roguelike, fps, tps, horror, racing, sports, sandbox, visual_novel, tower_defense, metroidvania, soulslike, battle_royale, moba, card_game, rhythm, stealth, immersive_sim, open_world

**Supported art styles:** realistic, stylized, pixel_art_2d, pixel_art_3d, low_poly, cel_shaded, hand_painted, voxel, retro_16bit, retro_8bit, minimalist, watercolor, comic_book, anime, photorealistic, abstract, paper_cutout, claymation, ink_brush

**Supported platforms:** pc, mac, linux, web, android, ios, vr_quest, vr_pcvr, console_switch, console_ps5, console_xbox

## Components

### Schema (`schema/`)

The formal JSON Schema definition for `game_dna.json` files. Engine-agnostic and designed for human-AI collaboration: humans define creative vision, AI agents generate assets and code.

```bash
# Validate with Python directly
python -c "import jsonschema, json; jsonschema.validate(json.load(open('my_game.json')), json.load(open('schema/game_dna.schema.json')))"

# Or use the CLI (recommended)
forgedna validate my_game.json
```

The schema supports custom extensions via the `custom_mechanics` field in the mechanics section, allowing game-specific unique mechanics without modifying the core schema.

### CLI Tool (`cli/`)

The `forgedna` command-line tool for schema validation, creation, comparison, and export.

**Installation:**
```bash
cd cli
pip install -e .
```

**All 8 commands:**

```
forgedna validate <file>              Validate a game DNA file against the schema
forgedna init [--template <name>]     Create new game_dna.json from built-in template
                                       Templates: minimal, rpg, platformer, puzzle
forgedna remix <file>                 Fork with lineage metadata preserved
                                       Use -o to specify output path
forgedna info <file>                  Show summary statistics (title, genre, counts)
forgedna diff <file1> <file2>         Compare two DNA files, show what changed
forgedna list-templates               List all available built-in templates
forgedna export -f summary <file>     Export as a markdown summary document
forgedna export -f prompt <file>      Export as an AI agent prompt for building
```

**Examples:**
```bash
# Create a new RPG from template
forgedna init --template rpg -o my_rpg.json

# Check what's in a game file
forgedna info examples/fantasy-mmorpg.json

# Compare two designs
forgedna diff examples/pixel-drift.json examples/quiet-hollow.json

# Generate a prompt for an AI agent to build the game
forgedna export -f prompt examples/quiet-hollow.json > build_prompt.txt
```

### Community Hub (`hub/`)

A Gradio web app for browsing, viewing, editing, and remixing GameDNA schemas. Deployable locally or to Hugging Face Spaces.

**Running locally:**
```bash
cd hub
pip install -r requirements.txt
python app.py
# Opens at http://localhost:7860
```

**Features:**
- Browse and filter game DNA files by genre, art style, complexity
- Visual form-based JSON editor with live schema validation
- Remix any DNA file with one click (fork + edit)
- Upload and download game_dna.json files
- Rich section viewers for meta, mechanics, world, entities, assets, logic, UI
- HF Storage integration for persistent community collections

**HF Spaces deployment:**
```bash
# Set these environment variables in your Space:
HF_TOKEN=hf_your_token_here
FORGEDNA_HUB_REPO=your-username/your-dataset-repo

# The app auto-detects HF Spaces and enables persistent storage
```

### Substrate Harness (`harness/`)

The agentic build pipeline that turns GameDNA schemas into games. This is the crown jewel — a pipeline orchestrator that decomposes a game design into parallelizable tasks and coordinates 17 specialized AI agents to generate all assets, code, and content.

**Installation:**
```bash
cd harness
pip install -e .
```

**How it works:**
```
game_dna.json
    |
    v
[DNA Parser] ---------> Extracts: asset descriptions, quest logic,
    |                     dungeon specs, mechanics, entity definitions
    v
[Task Decomposer] -----> Breaks DNA into a DAG of 24-84+ tasks:
    |                     - 3D asset generation
    |                     - Texture generation
    |                     - Audio generation (music, SFX, ambient)
    |                     - Code generation (scripts, scenes)
    |                     - UI generation
    v
[Agent Orchestrator] --> Dispatches tasks to specialized agents,
    |                     respects dependencies, manages parallelism
    v
[Assembly Agent] ------> Wires everything into the target engine:
    |                     - Imports 3D models
    |                     - Applies textures
    |                     - Connects audio
    |                     - Links scripts to scenes
    |                     - Builds UI layouts
    v
[Test Agent] ----------> Validates the built game compiles and runs
    |
    v
[Output] --------------> Playable game build (.apk, .exe, HTML5)
```

**All 6 harness commands:**
```
forgedna-harness parse <file>       Parse and show DNA structure summary
forgedna-harness plan <file>        Generate build plan (task DAG)
                                      -o to save plan to JSON
                                      -v for full task tree
forgedna-harness stat <file>        Detailed content inventory + build estimate
                                       Shows parallelism analysis
forgedna-harness dry-run <file>     Simulate full pipeline without generating
                                       Shows iteration-by-iteration execution
forgedna-harness agents             List all 17 agent types and capabilities
forgedna-harness prompt <file> <id> Generate agent prompt for a specific task
```

**Examples:**
```bash
# See what the harness sees in a game file
forgedna-harness parse examples/quiet-hollow.json

# Generate and save a build plan
forgedna-harness plan examples/quiet-hollow.json -v -o plan.json

# Get a full inventory of what needs to be built
forgedna-harness stat examples/fantasy-mmorpg.json

# Simulate the build (no actual generation)
forgedna-harness dry-run examples/pixel-drift.json

# See all available agent types
forgedna-harness agents

# Generate a prompt for a specific build task
forgedna-harness prompt examples/quiet-hollow.json qh_assets_001
```

**Agent Types (17 total):**

```
ASSET AGENTS (parallelizable)
  asset_3d          3D Asset Generator     - 3D meshes via TripoSR, InstantMesh
  texture           Texture Generator      - PBR textures via Stable Diffusion
  animation         Animation Generator    - Skeletal animations from text
  vfx               VFX Generator          - Shaders, particles, post-processing

AUDIO AGENTS (parallelizable)
  audio_music       Music Generator        - Background music, themes
  audio_sfx         SFX Generator          - Sound effects from descriptions
  audio_ambient     Ambient Generator      - Environmental soundscapes
  audio_voice       Voice Generator        - NPC voices with character profiles

CODE AGENTS
  code_player       Player Controller      - Movement, abilities, glyph systems
  code_enemy        Enemy AI               - Behavior trees, attack patterns
  code_combat       Combat System          - Damage calc, status effects
  code_quest        Quest System           - Quest logic, dialogue trees
  code_crafting     Crafting System        - Recipes, gathering, economy
  code_ui           UI Agent               - HUD, menus, inventory screens
  code_world        World Building         - Levels, scenes, day-night, weather

PIPELINE AGENTS
  assembly          Assembly Agent         - Integrates all assets into engine
  test              Test Agent             - Validates compilation, no crashes
```

## Example Games

The `examples/` directory includes three complete GameDNA files demonstrating the schema at different scales:

```
File                      Game                          Complexity     Size
---------------------------------------------------------------------------
fantasy-mmorpg.json       Echoes of Aethermoor          Full schema    ~52KB
                          5-region MMORPG with 8 elements, classless glyph
                          system, 5 dungeons, 20-person raid, player economy

pixel-drift.json          Pixel Drift                   Focused        ~14KB
                          Retro-futuristic 2D hover-bike racing with drifting
                          mechanics, 3 environments, procedural tracks

quiet-hollow.json         Quiet Hollow                  Minimal        ~12KB
                          Cozy hand-painted puzzle-adventure about restoring
                          a garden. No combat, plant growth puzzles
---------------------------------------------------------------------------
```

```bash
# Explore any example
forgedna info examples/fantasy-mmorpg.json
forgedna-harness stat examples/pixel-drift.json
forgedna-harness dry-run examples/quiet-hollow.json
```

## Repository Structure

```
ForgeDNA/
  schema/                     Formal JSON Schema definition (draft-07)
    game_dna.schema.json
  examples/                   Complete example game DNA files
    fantasy-mmorpg.json
    pixel-drift.json
    quiet-hollow.json
  cli/                        forgedna CLI tool (Python + Typer)
    forgedna/
      cli.py                  Entry point, 8 commands
      validate.py             Schema validation
      init.py                 Template creation
      remix.py                Fork with lineage
      export.py               Export to markdown/prompt
      info.py                 Summary statistics
      diff.py                 Comparison tool
      templates/              Built-in templates
  hub/                        Community Hub (Gradio web app)
    app.py                    Browse, view, edit, remix
    requirements.txt
  harness/                    Substrate Harness (agentic pipeline)
    harness/
      cli.py                  6 harness commands
      dna_parser.py           GameDNA parsing
      task_decomposer.py      DAG task decomposition
      orchestrator.py         Agent orchestration
      agent_specs.py          17 agent type definitions
      mcp_server.py           MCP server for agent integration
  Schema-Builder/             React/Vite frontend (planned)
  IMPLEMENTATION_PLAN.md      Development roadmap
  LICENSE                     Apache-2.0
```

## Contributing

ForgeDNA is entirely open source. Contributions are welcome in all areas:

**Schema improvements:**
- Add new mechanics, art styles, or genre types to the schema
- Submit example game DNA files for new genres
- Improve validation rules and error messages

**New agent types:**
- Add agent specs in `harness/harness/agent_specs.py`
- Each agent needs: type, name, description, tools, models, parallelization config
- See existing specs for the pattern

**New templates:**
- Add JSON template files to `cli/forgedna/templates/`
- Register them in `cli/forgedna/init.py`

**Hub features:**
- Enhance the Gradio UI in `hub/app.py`
- Add search, filtering, and community features
- Contribute to the planned React frontend

**Harness improvements:**
- Improve task decomposition strategies
- Add new engine adapters (Unity, Unreal, Web)
- Enhance the MCP server capabilities

```bash
# Fork, clone, and install in dev mode
git clone https://github.com/your-username/ForgeDNA.git
cd ForgeDNA
cd cli && pip install -e . && cd ..
cd harness && pip install -e . && cd ..

# Make your changes, then submit a PR
```

## License

Apache-2.0 — see [LICENSE](LICENSE) for details.

Free to use, modify, and distribute. Build games, build tools, build the future of AI-powered game development.
