<div align="center">
  <h1>🧬 ForgeDNA</h1>
  <p><b>A text-first game design platform for AI Agents.</b></p>
</div>

## What is ForgeDNA?

**ForgeDNA** is an open-source ecosystem designed to bridge the gap between human creativity and AI-powered game development. It allows creators to define VR/3D games as lightweight, structure JSON schemas called **"GameDNA"**. 

Instead of fighting complex UI editors, you write (or visually generate) your game's mechanics, player rigs, environments, and logic recipes. You then hand that schema to a local AI agent (like those running in LM Studio or Claude), which acts as a virtual developer to auto-generate a complete, playable Godot 4.x VR project.

---

## 🌍 The ForgeDNA Workflow Architecture

The ecosystem relies on a beautiful two-part workflow: **The Cloud (Hub)** and **The Local Engine (Substrate)**.

### Part 1: The Community Hub (`forgedna.org`)
This repository contains the full source code for our Community Hub web application (located in `Schema-Builder/`). Hosted on Replit, the Community Hub is where you act as the "Game Director".
* Visual interface for constructing `game_dna.json` files without touching code.
* Social features: browse, star, and remix community templates.
* Download your perfected `game_dna.json` schema to your machine.

### Part 2: The Agent Substrate (`forge-substrate`)
Once you have your schema, it's time for the AI to build the game. Located at `Schema-Builder/artifacts/forge-substrate/`, the **ForgeSubstrate** is a secure, headless Godot Docker container that runs on your *local machine*. 

It exposes a Model Context Protocol (MCP) Server via SSE, giving your local AI agents Godot-specific superpowers:
- `ingest_schema`: Initializes a Godot project.
- `execute_workspace_command`: Allows the agent to run Godot CLI commands or download assets.
- File I/O tools: Allows the agent to write `.gd` (GDScript) or `.tscn` (scene) files.
- `compile_and_export_game`: Exports the completed game to `.apk`, `.exe`, or HTML5.

---

## 🚀 Getting Started

To get your AI Agent building games, follow these simple steps to spin up the ForgeSubstrate on your machine.

### 1. Prerequisites
- **Docker Desktop**: Required to run the isolated Godot container.
- **LM Studio** (or another MCP-compatible AI agent).

### 2. Run the ForgeSubstrate
Clone this repository to your local machine and build the Docker container:
```bash
git clone https://github.com/yourusername/ForgeDNA.git
cd ForgeDNA
docker build -t forge-substrate -f Schema-Builder/artifacts/forge-substrate/Dockerfile.godot .
```
Start the container (this exposes the agent endpoint on port 8080):
```bash
docker run -p 8080:8080 -d forge-substrate
```

### 3. Connect your Agent
In LM Studio (or your MCP agent), add a new **SSE (Server-Sent Events) Server** pointing to:
`http://localhost:8080/sse`

### 4. Build the Game!
Download a schema from [forgedna.org](#) and prompt your agent:
> *"I have connected you to the ForgeSubstrate MCP server running locally via Docker. First, ingest this game schema using the `ingest_schema` tool, naming the project 'MyFirstVRGame': [paste game_dna.json text here]. Next, build out the player controllers and scenes according to the schema. Finally, use the Godot validation tool to check for errors, and export it for Android."*

Your compiled `.apk` or `.exe` game files will be generated securely inside the Docker container!

See the comprehensive [USER MANUAL](USER_MANUAL.md) for detailed extraction commands and deep-dives into the agent's capabilities.

---

## The GameDNA Schema

The heart of ForgeDNA is the **`game_dna.json` schema** — a universal, engine-agnostic JSON format for defining complete game designs. It captures everything an AI agent needs to generate a playable game:

| Section | Purpose |
|---------|---------|
| `meta` | Title, genre, art style, platforms, player count |
| `mechanics` | Movement, combat, crafting, progression, economy, custom mechanics |
| `world` | Environments, dungeons, procedural generation, weather |
| `entities` | Player, NPCs, enemies, items, equipment |
| `assets` | AI-generation-ready descriptions for 3D models, textures, audio, VFX |
| `logic` | Quests, world events, skill trees, crafting recipes |
| `ui` | HUD layout, menus, accessibility, color palette |

### Schema Location

- **Schema definition:** `schema/game_dna.schema.json`
- **JSON Schema spec:** Validatable with any JSON Schema validator (draft-07)

### Example GameDNA Files

| File | Game | Complexity |
|------|------|------------|
| `examples/fantasy-mmorpg.json` | **Echoes of Aethermoor** — 5-region MMORPG with 8 elements, classless glyph system, 5 difficult dungeons, 20-person raid, player economy | ~52KB, full schema |
| `examples/pixel-drift.json` | **Pixel Drift** — Retro-futuristic 2D hover-bike racing with drifting mechanics, 3 environments, procedural tracks | ~14KB, focused |
| `examples/quiet-hollow.json` | **Quiet Hollow** — Cozy hand-painted puzzle-adventure about restoring a garden. No combat, plant growth puzzles | ~12KB, minimal |

### Using the Schema

```bash
# Validate a game_dna.json file against the schema
python -c "import jsonschema; import json; schema=json.load(open('schema/game_dna.schema.json')); dna=json.load(open('your_game.json')); jsonschema.validate(dna, schema)"

# Or use any online JSON Schema validator with draft-07 support
```

## The CLI Tool (`forgedna`)

A Python CLI for working with GameDNA schemas.

### Installation
```bash
cd cli
pip install -e .
```

### Commands
| Command | Description |
|---------|-------------|
| `forgedna validate <file>` | Validate against schema |
| `forgedna init [--template rpg]` | Create new from template |
| `forgedna remix <file>` | Fork with lineage metadata |
| `forgedna info <file>` | Show summary statistics |
| `forgedna diff <file1> <file2>` | Compare two DNA files |
| `forgedna list-templates` | List built-in templates |
| `forgedna export --format summary` | Export as markdown |
| `forgedna export --format prompt` | Export as AI agent prompt |

## The Community Hub (`hub/`)

A Gradio web app for browsing, editing, and remixing GameDNA schemas.

### Running Locally
```bash
cd hub
pip install -r requirements.txt
python app.py
# Opens at http://localhost:7860
```

### Features
- Browse and filter game DNA files
- Visual form-based JSON editor with live validation
- Remix any DNA file with one click
- Upload/download game_dna.json files
- HF Storage integration (optional — set `HF_TOKEN` and `FORGEDNA_HUB_REPO`)

## The Substrate Harness (`harness/`)

The agentic build pipeline that turns GameDNA schemas into games. Decomposes a game design into parallelizable tasks and orchestrates AI agents to generate all assets, code, and content.

### Installation
```bash
cd harness
pip install -e .
```

### Commands
| Command | Description |
|---------|-------------|
| `forgedna-harness parse <file>` | Parse and show DNA structure |
| `forgedna-harness plan <file>` | Generate build plan (task DAG) |
| `forgedna-harness stat <file>` | Detailed content inventory + build estimate |
| `forgedna-harness dry-run <file>` | Simulate full build pipeline |
| `forgedna-harness agents` | List all agent types and capabilities |
| `forgedna-harness prompt <file> <task_id>` | Generate agent prompt for a task |

### Agent Types (17 total)
- **Asset:** 3D Generator, Texture Generator, Animation Generator, VFX Generator
- **Audio:** Music Generator, SFX Generator, Ambient Generator, Voice Generator
- **Code:** Player Controller, Enemy AI, Combat System, Quest System, Crafting, UI, World Building
- **Pipeline:** Assembly Agent, Test Agent

### How It Works
1. **Parse** — Reads game_dna.json and extracts all buildable content
2. **Decompose** — Breaks into a DAG of ~24-84+ tasks (depending on game complexity)
3. **Orchestrate** — Dispatches tasks to specialized agents, respecting dependencies
4. **Assemble** — Integration agent wires everything together
5. **Test** — Automated validation of the built game

---

## Repository Structure

* `schema/` — The formal JSON Schema definition for game_dna.json files.
* `examples/` — Example GameDNA files (Echoes of Aethermoor, Pixel Drift, Quiet Hollow).
* `cli/` — The `forgedna` CLI tool for schema validation, creation, and export.
* `hub/` — The Community Hub — Gradio web app for browsing, editing, and remixing.
* `harness/` — The Substrate Harness — agentic build pipeline (17 agent types, task DAG orchestrator).
* `Schema-Builder/artifacts/forge-dna/` - The React/Vite Frontend for the Community Hub (planned).
* `Schema-Builder/artifacts/api-server/` - The Express API Server and PostgreSQL backend (planned).
* `Schema-Builder/artifacts/forge-substrate/` - The headless Godot Docker container / MCP Server (planned).

## 🤝 Contributing
ForgeDNA is entirely open source! Pull requests are welcomed to improve the standard `game_dna.json` schema layout or to augment the ForgeSubstrate with new tools and export capabilities.
