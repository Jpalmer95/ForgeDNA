# ForgeDNA Full Stack Implementation Plan

> **Goal:** Build the complete ForgeDNA ecosystem — CLI tool, Community Hub, and Substrate Harness — enabling anyone to create, share, remix, and build games from GameDNA schemas with AI agent collaboration.

**Architecture:** Three-layer system:
1. **CLI Tool** (`forgedna`) — Developer-facing schema operations
2. **Community Hub** (web) — Visual schema builder, browsing, remixing
3. **Substrate Harness** — Agentic build pipeline that turns schemas into games

**Tech Stack:**
- CLI: Python + Typer + jsonschema
- Hub: React + Vite + Express + PostgreSQL (or lightweight Python/Gradio alternative)
- Harness: Python + MCP + HF Harness integration

---

## Phase 1: CLI Tool (`forgedna`)

The CLI is the fastest to build and immediately useful. Everything else builds on top of it.

### Project Structure

```
ForgeDNA/
  cli/
    pyproject.toml
    forgedna/
      __init__.py
      cli.py            # Typer app entry point
      validate.py       # Schema validation
      init.py           # Create new game DNA from templates
      remix.py          # Fork/modify existing DNA
      export.py         # Export to different formats
      templates/        # Built-in templates
        minimal.json
        rpg.json
        platformer.json
        puzzle.json
      schemas/
        game_dna.schema.json  # Copy from ../schema/
```

### Commands

| Command | Description |
|---------|-------------|
| `forgedna validate <file>` | Validate against schema, show errors with line numbers |
| `forgedna init [--template <name>]` | Create new game_dna.json from template |
| `forgedna remix <file>` | Copy and open for editing, preserving lineage |
| `forgedna info <file>` | Summary: title, genre, regions, dungeons, entity count |
| `forgedna diff <file1> <file2>` | Compare two DNA files, show what changed |
| `forgedna list-templates` | Show available templates |
| `forgedna export --format summary <file>` | Export as markdown summary |
| `forgedna export --format prompt <file>` | Export as AI agent prompt |

---

## Phase 2: Community Hub

Start lightweight — a Python/Gradio app deployable to HF Spaces for free. Can upgrade to full React later.

### Option A: Gradio Hub (Fast to Ship)
- Deploy to HF Spaces (free tier)
- Browse example DNA files
- Visual JSON editor (schema-driven form)
- Download/upload game_dna.json
- Remix button (fork + edit)
- Star/favorite system (localStorage initially, DB later)

### Option B: Full React Hub (Production)
- React + Vite frontend
- Express API server
- PostgreSQL for users, schemas, stars, forks
- Auth (GitHub OAuth)
- Visual schema builder with drag-and-drop
- Schema versioning and lineage tracking
- Community features (comments, ratings, trending)

**Recommendation:** Start with Option A (Gradio), validate the concept, then build Option B.

---

## Phase 3: Substrate Harness

This is the crown jewel — the system that actually builds games from DNA. It's a pipeline orchestrator that coordinates multiple AI agents.

### Architecture

```
game_dna.json
    |
    v
[DNA Parser] --> Extracts: asset descriptions, quest logic, dungeon specs, etc.
    |
    v
[Task Decomposer] --> Breaks DNA into parallelizable workstreams:
    |                   - 3D asset generation
    |                   - Texture generation
    |                   - Audio generation (music, SFX, ambient)
    |                   - Code generation (scripts, scenes)
    |                   - UI generation
    |
    v
[Agent Orchestrator] --> Spawns/manages subagents per workstream:
    |                     - 3D Agent (Blender/TripoSR)
    |                     - Texture Agent (Stable Diffusion)
    |                     - Audio Agent (AudioCraft/MusicGen)
    |                     - Code Agent (Godot/Unity)
    |                     - UI Agent (UI framework)
    |
    v
[Asset Registry] --> Tracks all generated assets, their status,
    |                 and dependencies between them
    |
    v
[Assembly Agent] --> Integrates everything into the target engine:
    |                 - Imports 3D models
    |                 - Applies textures
    |                 - Wires up audio
    |                 - Connects scripts to scenes
    |                 - Builds UI
    |
    v
[Build Pipeline] --> Compiles and exports:
    |                 - Godot: headless export to .pck/.exe/.apk
    |                 - Unity: headless build via CLI
    |                 - Web: export as HTML5
    |
    v
[Output] --> Playable game build
```

### Key Design Decisions

1. **MCP-Native:** Each substrate exposes tools via MCP, so any agent (Hermes, Claude Code, Codex, LM Studio) can drive it
2. **Engine-Agnostic Core:** The DNA parser, task decomposer, and orchestrator don't care about the engine. Engine-specific adapters are pluggable.
3. **HF Harness Integration:** Asset generation uses HF Harness for model access (free tier)
4. **Incremental Build:** Don't regenerate everything if only one section changed. Hash-based caching.
5. **Human-in-the-Loop:** At each major checkpoint, pause and let the human review/approve before proceeding.

### Substrate Modes

| Mode | Description |
|------|-------------|
| `local` | Docker container on user's machine (like existing forge-substrate) |
| `cloud` | Runs on HF Spaces or Modal for users without local GPU |
| `hybrid` | Light tasks local, heavy GPU tasks cloud |

---

## Execution Order

1. **CLI Tool** — Build first. Foundation for everything. ~2-3 hours.
2. **Gradio Hub** — Quick validation of community concept. ~2-3 hours.
3. **Substrate Harness Core** — DNA parser + task decomposer + agent orchestrator. ~4-6 hours.
4. **Engine Adapters** — Godot first, then Unity/Web. ~3-4 hours each.
5. **Full React Hub** — Production community platform. ~8-12 hours.

---

## Verification Steps

### CLI Tool
```bash
cd ~/workspace/projects/ForgeDNA/cli
pip install -e .
forgedna validate ../examples/fantasy-mmorpg.json   # Should pass
forgedna init --template rpg                         # Creates game_dna.json
forgedna info ../examples/fantasy-mmorpg.json        # Shows summary
forgedna diff ../examples/pixel-drift.json ../examples/quiet-hollow.json
```

### Gradio Hub
```bash
cd ~/workspace/projects/ForgeDNA/hub
pip install -r requirements.txt
python app.py                    # Opens at http://localhost:7860
# Can browse, view, edit, and download DNA files
```

### Substrate Harness
```bash
cd ~/workspace/projects/ForgeDNA/harness
pip install -e .
forgedna-harness parse ../examples/quiet-hollow.json   # Shows task breakdown
forgedna-harness plan ../examples/quiet-hollow.json    # Shows execution plan
forgedna-harness dry-run ../examples/quiet-hollow.json # Simulates without generating
```
