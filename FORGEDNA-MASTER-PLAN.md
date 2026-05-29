# ForgeDNA Ecosystem Master Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan phase-by-phase.

**Vision:** Transform ForgeDNA from a prototype into a fully functioning, open ecosystem where anyone (humans and AI agents) can collaboratively create next-generation games and experiences. Text-first, engine-agnostic, community-positive, agent-native.

**Current State:** Working prototype with solid schema (22.8KB), DAG orchestration, 9/17 functional agents (code generation works, asset/audio stubbed), Gradio hub, and Godot adapter. Missing: real-time collaboration, agent identity, lineage visualization, progressive buildout, multi-agent communication, community features.

**Goal:** Build the infrastructure for a thriving open-source game creation ecosystem where text specs evolve into playable games through community and agent collaboration.

---

## How to Use This Document

1. **Phase-by-phase execution only** — Complete all tasks in Phase N before starting Phase N+1
2. **Mark [x] only after Success Criteria pass** — Binary outcomes, no wishful thinking
3. **Atomic commits** — One logical change per commit, conventional commit messages
4. **Never commit secrets** — Use .env files, never hardcode API keys
5. **Each phase is independently shippable** — Deliver value at every milestone

---

## Phase 0: Foundation & Decommissioning (Week 1-2)

**Goal:** Remove prototype limitations, establish new architecture foundation, add lineage tracking.

### Task 0.1: Decommission Static Hub Storage

**Objective:** Replace file-based storage with PostgreSQL + Supabase for real collaboration.

**Files:**
- Create: `hub/db/supabase_client.py`
- Create: `hub/db/models.py` (SQLAlchemy models)
- Create: `hub/db/migrations/` (Alembic setup)
- Modify: `hub/storage.py` (refactor to use DB instead of files)
- Create: `hub/.env.example`

**Success Criteria:**
- [ ] `hub/.env.example` documents all required environment variables
- [ ] PostgreSQL schema includes: `dna_files`, `users`, `agents`, `lineage`, `builds`, `comments`
- [ ] `hub/storage.py` methods (save, load, list_all, search) work with DB backend
- [ ] `docker-compose.yml` spins up Postgres + Hub + Harness together
- [ ] Existing DNA files can be migrated from file storage to DB via script

**Commands:**
```bash
cd hub
pip install supabase sqlalchemy alembic psycopg2-binary python-dotenv
# Run migrations
alembic upgrade head
# Test with sample DNA
python -c "from storage import DNAStorage; s = DNAStorage(); s.save(open('examples/quiet_hollow.json').read())"
```

---

### Task 0.2: Add Lineage Tracking to Schema

**Objective:** Enable full remix ancestry tracking in game_dna.json.

**Files:**
- Modify: `schema/game_dna.schema.json` (add `lineage` object to `meta`)
- Modify: `cli/forgedna/remix.py` (populate lineage on remix)
- Create: `cli/forgedna/lineage.py` (new command)

**Schema Addition:**
```json
"meta": {
  "lineage": {
    "type": "object",
    "properties": {
      "original": { "type": "string", "description": "UUID of original DNA" },
      "parent": { "type": "string", "description": "UUID of immediate parent" },
      "generation": { "type": "integer", "description": "Remix generation number" },
      "siblings": { "type": "array", "items": { "type": "string" } }
    }
  }
}
```

**Success Criteria:**
- [ ] `forgedna remix` creates DNA with full lineage object
- [ ] `forgedna lineage <file>` prints ancestry tree (parent → child relationships)
- [ ] Lineage is preserved through multiple remix generations
- [ ] Schema validates lineage structure

**Commands:**
```bash
forgedna remix examples/quiet_hollow.json -o remix1.json
forgedna remix remix1.json -o remix2.json
forgedna lineage remix2.json
# Expected output:
# Original: quiet_hollow (gen 0)
#   └─ remix1 (gen 1)
#       └─ remix2 (gen 2)
```

---

### Task 0.3: Agent Identity Registry

**Objective:** Create a system for agents to register themselves with identity and capabilities.

**Files:**
- Create: `agents/registry.py` (agent registration + lookup)
- Create: `agents/models.py` (Agent dataclass)
- Create: `agents/registry.json` (example registry)
- Modify: `harness/harness/agent_specs.py` (link to registry)

**Agent Model:**
```python
@dataclass
class Agent:
    agent_id: str  # unique identifier
    name: str
    type: str  # matches AgentType enum
    capabilities: list[str]
    owner: str  # human or org
    endpoint: str  # MCP server URL or local path
    reputation_score: float  # 0-5
    total_builds: int
    avg_quality: float
    created_at: datetime
```

**Success Criteria:**
- [ ] Agents can register via `register_agent(agent: Agent)`
- [ ] Registry supports lookup by ID, type, capability
- [ ] `forgedna-harness agents` shows registered agents with reputation
- [ ] Registry persists to JSON or database
- [ ] MCP tool `list_agents` returns registry data

**Commands:**
```bash
# Register a custom texture agent
python -c "from agents.registry import register_agent, Agent; register_agent(Agent('tex-gen-01', 'Texture Pro', 'TEXTURE', ['pbr', 'stylized'], 'jpalmer95', 'http://localhost:8081', 4.5, 10, 0.9))"

# List all agents
forgedna-harness agents
```

---

### Task 0.4: GitHub-Style DNA Collaboration

**Objective:** Enable fork → edit → PR → merge workflow for DNA files.

**Files:**
- Create: `hub/api/collaboration.py` (Fork, PR, Merge endpoints)
- Create: `hub/db/models.py` (add `forks`, `pull_requests` tables)
- Modify: `hub/app.py` (add Fork/PR UI)

**Success Criteria:**
- [ ] Users can fork any DNA (creates copy with `lineage.parent` set)
- [ ] Users can create PRs from fork to parent
- [ ] PR shows diff between fork and parent
- [ ] PR can be merged (changes applied to parent)
- [ ] Lineage tracks fork relationships

**Commands:**
```bash
# In Hub UI:
# 1. Click "Fork" on quiet_hollow.json
# 2. Edit the fork
# 3. Click "Create Pull Request"
# 4. Reviewer sees diff, clicks "Merge"
# 5. Original quiet_hollow.json is updated, lineage preserved
```

---

### Task 0.5: Engine Adapter Plugin Interface

**Objective:** Clean abstraction so community can add Unity, Unreal, Bevy, etc.

**Files:**
- Create: `harness/harness/engine_adapters/base.py` (abstract EngineAdapter class)
- Modify: `harness/harness/engine_adapters/godot.py` (implement interface)
- Create: `harness/harness/engine_adapters/registry.py` (adapter discovery)
- Create: `docs/creating-engine-adapters.md` (guide for contributors)

**Interface:**
```python
class EngineAdapter(ABC):
    @abstractmethod
    def generate_project(self, dna: GameDNA, outputs: dict, output_dir: str) -> str:
        """Generate complete engine project. Returns path to project root."""
        pass
    
    @abstractmethod
    def get_supported_features(self) -> list[str]:
        """Return list of supported DNA features (e.g., 'day_night', 'crafting')."""
        pass
    
    @abstractmethod
    def get_export_targets(self) -> list[str]:
        """Return supported export platforms (e.g., 'web', 'android', 'pc')."""
        pass
```

**Success Criteria:**
- [ ] `EngineAdapter` ABC defined with all required methods
- [ ] `GodotAdapter` implements interface correctly (existing tests pass)
- [ ] `forgedna-harness adapters` lists all installed adapters
- [ ] Docs explain how to create new adapters (with example)
- [ ] At least one community adapter stub (Unity or Bevy) created as template

**Commands:**
```bash
# List available adapters
forgedna-harness adapters
# Expected:
# - godot (built-in): 27/27 features supported
# - unity (community): 20/27 features supported [not installed, pip install forgedna-unity]

# Use specific adapter
forgedna-harness build-full my_game.json --engine unity
```

---

**Phase 0 Success Criteria (All Must Pass):**
- [ ] Hub storage migrated to PostgreSQL (no more file-based storage)
- [ ] Lineage tracking works end-to-end (remix → lineage command shows tree)
- [ ] Agent registry accepts registrations and provides lookup
- [ ] Fork/PR/merge workflow functional for DNA files
- [ ] Engine adapter interface defined and Godot adapter updated
- [ ] All existing tests pass with new architecture
- [ ] Docker Compose brings up full stack (Postgres + Hub + Harness)

**Deliverables:**
- Updated schema with lineage support
- PostgreSQL-backed Hub with collaboration features
- Agent identity system
- Clean engine adapter plugin architecture
- `docker-compose.yml` for full stack deployment

---

## Phase 1: Progressive Buildout & Visualization (Week 3-4)

**Goal:** Make the "text → playable game" progression visible and interactive.

### Task 1.1: Build Progress Tracking

**Objective:** Track and display what's been built vs what's still DNA-only.

**Files:**
- Create: `hub/db/models.py` (add `build_progress` table)
- Create: `harness/harness/progress.py` (track completion %)
- Modify: `hub/app.py` (show progress indicators)

**Progress Levels:**
- 0% = DNA only (text spec)
- 25% = Some assets generated (at least one 3D model or texture)
- 50% = Code + assets generated, not assembled
- 75% = Assembled into engine project, not tested
- 100% = Playable build exists (exported)

**Success Criteria:**
- [ ] Each DNA shows progress % in Hub gallery
- [ ] Clicking DNA shows breakdown: "Assets: 3/10, Code: 5/7, Assembly: pending"
- [ ] Progress updates automatically as agents complete tasks
- [ ] "Continue Building" button resumes from last checkpoint

---

### Task 1.2: Asset Preview System

**Objective:** View generated assets (3D models, textures, audio, code) in Hub.

**Files:**
- Create: `hub/preview/viewer_3d.py` (Three.js model viewer)
- Create: `hub/preview/audio_player.py` (HTML5 audio)
- Create: `hub/preview/code_display.py` (syntax highlighting)
- Modify: `hub/app.py` (integrate preview panels)

**Success Criteria:**
- [ ] 3D models render in browser with orbit controls
- [ ] Audio files play in browser
- [ ] Code displays with syntax highlighting
- [ ] Textures display with PBR preview (if normal/roughness maps exist)

---

### Task 1.3: Web Export & Playtesting

**Objective:** Enable in-browser playtesting of built games.

**Files:**
- Create: `harness/harness/exporters/web.py` (HTML5 export for Godot)
- Create: `hub/playtest/embed.py` (iframe embed for playable builds)
- Modify: `hub/app.py` (add "Play in Browser" button)

**Success Criteria:**
- [ ] `forgedna-harness export my_game.json --target web` generates HTML5 build
- [ ] Hub embeds playable build in iframe
- [ ] "Quick Preview" mode generates vertical slice in <5 minutes
- [ ] Playtest feedback system: users leave timestamped comments

---

**Phase 1 Success Criteria:**
- [ ] Build progress visible for every DNA in Hub
- [ ] Generated assets previewable in browser (3D, audio, code)
- [ ] At least one game exportable to web and playable in Hub
- [ ] "Continue Building" resumes from last checkpoint

---

## Phase 2: Multi-Agent Collaboration (Week 5-8)

**Goal:** Enable agents to communicate, coordinate, and enhance each other's work.

### Task 2.1: Shared State Bus

**Objective:** Agents read/write to central GameState, enabling coordination.

### Task 2.2: Event System

**Objective:** Agents emit events when they add mechanics/assets, other agents react.

### Task 2.3: Agent Delegation Protocol

**Objective:** Agents can delegate tasks to specialized sub-agents.

### Task 2.4: Multi-Agent Orchestration Modes

**Objective:** Support sequential, parallel, iterative, and adversarial modes.

---

**Phase 2 Success Criteria:**
- [ ] Agents can subscribe to events and react to other agents' outputs
- [ ] When `code_player` adds double-jump, `level_design` agent automatically adjusts platforms
- [ ] Agent marketplace shows reputation scores and usage stats
- [ ] At least one game built with 3+ agents collaborating in real-time

---

## Phase 3: Community & Marketplace (Week 9-12)

**Goal:** Build reputation, bounties, and marketplace for agents and DNA.

### Task 3.1: Bounty System

### Task 3.2: Agent Marketplace

### Task 3.3: Reputation & Portfolio

### Task 3.4: Cross-Game Pattern Library

---

**Phase 3 Success Criteria:**
- [ ] Bounties can be posted, claimed, and completed
- [ ] Agent marketplace shows ratings, usage, and pricing (if any)
- [ ] Contributors have public portfolios showing their games/agents
- [ ] Pattern library has 50+ reusable mechanics from community games

---

## Phase 4: Live Collaboration & Polish (Week 13+)

**Goal:** Real-time multiplayer editing, A/B testing, mobile access.

### Task 4.1: Real-Time CRDT Editing

### Task 4.2: A/B Testing for DNA Variants

### Task 4.3: Mobile App (Web-based)

### Task 4.4: Documentation & Onboarding

---

**Phase 4 Success Criteria:**
- [ ] Multiple users can edit same DNA simultaneously (Yjs/Automerge)
- [ ] A/B tests compare two DNA variants side-by-side
- [ ] Mobile-optimized web app for browsing/remixing
- [ ] Comprehensive docs + video tutorials for new users

---

## Future Roadmap (Post-Launch)

- Physics simulation support (for robotics RL training)
- Multiplayer networking code generation
- Procedural content generation agents
- AI playtesting agents that find bugs
- Integration with game distribution platforms (Steam, itch.io)
- Educational mode for teaching game design
- Enterprise features (private teams, SSO, audit logs)

---

## Metadata

**Date:** 2026-05-28  
**Owner:** Jonathan Korstad  
**Status:** Active  
**Note:** This document is authoritative for ForgeDNA ecosystem development.
