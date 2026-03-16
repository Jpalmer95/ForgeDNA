# ForgeDNA User Manual & Setup Guide

Welcome to the **ForgeDNA** ecosystem! This 0-to-1 beginner guide will walk you through setting up the ForgeSubstrate (a headless Godot environment exposed to AI agents via MCP) and connecting your agents to automatically build and export VR games from a `game_dna.json` schema.

---

## 1. What is ForgeDNA?

ForgeDNA is a platform where you can provide an AI agent (like those running in LM Studio) with a master game schema (`game_dna.json`), and the agent will use our specially designed **ForgeSubstrate** to do the heavy lifting. The ForgeSubstrate acts as the agent's hands: it's a secure, isolated Docker container featuring a headless Godot game engine. 

The agent connects to this container via the **Model Context Protocol (MCP)**, allowing it to:
- Instantiate new Godot projects.
- Read, write, and list scripts and scenes directly in the project space.
- Run arbitrary Godot CLI tools and install addons.
- Compile and export the final game for Android, Windows, or WebXR.

---

## 2. The End-to-End Workflow Explained

Building a game with ForgeDNA follows a simple two-part process:

**Part 1: The Community Hub (In your Web Browser)**
First, you visit the ForgeDNA Community Hub (our web application hosted on Replit). Here, you can visually create, edit, or remix an existing GameDNA JSON schema from the community. Once your schema is perfect, you download the `game_dna.json` file to your computer.

**Part 2: The Agent Substrate (On your Local Machine)**
Next, you start the `forge-substrate` Docker container **locally on your own computer**. This container acts as the secure sandbox. You then connect your local AI agent (like LM Studio) to this container and provide it with the `game_dna.json` you downloaded in Part 1. The agent will then build the Godot project and generate the actual playable game inside your local Docker container.

---

## 3. Prerequisites

Before you begin, ensure you have the following installed on your machine:
- **Docker Desktop**: This runs the ForgeSubstrate container locally.
- **LM Studio** (or any MCP-compatible AI agent interface like Claude Desktop).

---

## 4. Setting up the Local Substrate Container

Your local machine needs to run the ForgeSubstrate Docker container. This is where the magic happens and where the Godot engine actually lives.

### Step 3a: Clone the Repository
Open your terminal (Command Prompt, PowerShell, or Terminal) and clone the repository:
```bash
git clone https://github.com/your-username/ForgeDNA.git
cd ForgeDNA
```

### Step 3b: Build the Docker Image
Inside the `ForgeDNA/Schema-Builder/artifacts/forge-substrate` folder, there's a `Dockerfile.godot`. Build your Docker image with:
```bash
docker build -t forge-substrate -f Schema-Builder/artifacts/forge-substrate/Dockerfile.godot .
```

### Step 3c: Run the Container
Run the container to expose the Server-Sent Events (SSE) endpoint on port 8080:
```bash
docker run -p 8080:8080 -d forge-substrate
```
Your MCP server is now running! It exposes an endpoint at `http://localhost:8080/sse`.

---

## 5. Connecting Your Agent

Now we need to tell your AI Agent (running locally on your machine) how to talk to your local Substrate container.

### LM Studio Setup
1. Open **LM Studio**.
2. Go to the **Developer / MCP** section in the settings.
3. Add a new **SSE (Server-Sent Events)** server.
4. Set the URL to: `http://localhost:8080/sse`
5. Ensure the connection is established. You should see the tools appear in LM Studio.

If you are using a standard `stdio` connection (like Claude Desktop), configure your agent's config file (e.g., `mcp_config.json`) as follows:
```json
{
  "mcpServers": {
    "forge-substrate": {
      "command": "pnpm",
      "args": ["--filter", "forge-substrate", "run", "start"],
      "env": {}
    }
  }
}
```

---

## 6. From Schema to Game (The Agent's Workflow)

Once connected, you can interact with your agent and have it build your game.

### Step 6a: Get your Game DNA Schema from the Hub!
A `game_dna.json` file is basically the entire definition of your game—its storyline, mechanics, characters, and physics.
1. Open your web browser and visit the **ForgeDNA Community Hub** (hosted on Replit).
2. Browse the community schemas, find one you like, and hit **Remix** to make it your own, or just hit **Download**.
3. Save the resulting `game_dna.json` file to your computer.
4. Copy the entire text inside the JSON file.

### Step 6b: Instruct the Agent
Open a chat with your agent in LM Studio and give it a prompt like this:

> "I have connected you to the ForgeSubstrate MCP server running locally via Docker. First, ingest this game schema using the `ingest_schema` tool, naming the project 'MyFirstVRGame': [paste game_dna.json text here]. 
> Next, use the `write_file` tool and `execute_workspace_command` tool to build out the player controllers and scenes according to the schema. 
> Finally, use the Godot validation tool to check for errors, and then export it for Android using the `compile_and_export_game` tool."

### The Agent's Capabilities
Because you set up the Substrate, your agent has the following superpowers:
- **`ingest_schema`**: Instantiates the Godot project and saves the DNA.
- **`list_files` / `read_file` / `write_file`**: Reads and writes the actual `.gd` and `.tscn` Godot files needed to make the game real.
- **`execute_workspace_command`**: Runs Godot CLI tools (e.g., downloading plugins, addons, or formatting files).
- **`run_godot_validation`**: Validates the scripts headlessly.
- **`compile_and_export_game`**: Exports the game (to `.apk`, `.exe`, or HTML5).

---

## 7. Retrieving Your Exported Game

After the agent successfully uses the `compile_and_export_game` tool, the compiled game files (`.apk` or `.exe`) will be generated *inside* your local Docker container at:
`/app/workspace/MyFirstVRGame/builds/`

To extract the game back to your local machine, use the `docker cp` command. First, find your container ID:
```bash
docker ps
```
Then copy the build folder out:
```bash
docker cp <CONTAINER_ID>:/app/workspace/MyFirstVRGame/builds ./my_game_builds
```

Enjoy your brand new, AI-generated VR Game!
