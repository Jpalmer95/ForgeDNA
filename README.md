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

## 🛠️ Repository Structure
Because this is a full-stack monorepo, it contains both the frontend Hub and the backend Substrate:
* `Schema-Builder/artifacts/forge-dna/` - The React/Vite Frontend for the Community Hub.
* `Schema-Builder/artifacts/api-server/` - The Express API Server and PostgreSQL backend.
* `Schema-Builder/artifacts/forge-substrate/` - The headless Godot Docker container / MCP Server.

## 🤝 Contributing
ForgeDNA is entirely open source! Pull requests are welcomed to improve the standard `game_dna.json` schema layout or to augment the ForgeSubstrate with new tools and export capabilities.
