"""MCP Server — Expose harness tools for any MCP-compatible agent.

Any agent (Hermes, Claude Code, LM Studio, etc.) can connect to this server
and drive the game build pipeline by calling these tools.
"""
import json
from pathlib import Path
from typing import Any

from .agent_specs import AGENT_REGISTRY, AgentType
from .dna_parser import GameDNA, load_dna, load_dna_from_dict
from .orchestrator import Orchestrator
from .task_decomposer import BuildPlan, TaskStatus, decompose


class HarnessMCPServer:
    """MCP Server exposing harness tools for agent-driven game building."""

    def __init__(self):
        self.active_plans: dict[str, Orchestrator] = {}
        self.loaded_dna: dict[str, GameDNA] = {}

    def get_tools(self) -> list[dict[str, Any]]:
        """Return MCP tool definitions."""
        return [
            {
                "name": "parse_game_dna",
                "description": "Parse a game_dna.json file and return its structure summary. Call this first to understand what needs to be built.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "file_path": {"type": "string", "description": "Path to game_dna.json file"},
                    },
                    "required": ["file_path"],
                },
            },
            {
                "name": "generate_build_plan",
                "description": "Decompose a GameDNA into a build plan with parallelizable tasks. Returns task DAG with dependencies.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "file_path": {"type": "string", "description": "Path to game_dna.json file"},
                        "save_plan": {"type": "string", "description": "Optional: save plan to this path"},
                    },
                    "required": ["file_path"],
                },
            },
            {
                "name": "get_next_tasks",
                "description": "Get all tasks ready to execute (dependencies satisfied). Returns task details with agent prompts.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "plan_id": {"type": "string", "description": "Plan ID from generate_build_plan"},
                        "agent_type": {"type": "string", "description": "Optional: filter by agent type"},
                    },
                    "required": ["plan_id"],
                },
            },
            {
                "name": "get_task_prompt",
                "description": "Get the full agent prompt for a specific task. Use this to understand what to generate.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "plan_id": {"type": "string", "description": "Plan ID"},
                        "task_id": {"type": "string", "description": "Task ID"},
                    },
                    "required": ["plan_id", "task_id"],
                },
            },
            {
                "name": "start_task",
                "description": "Mark a task as running. Call this before generating assets/code for the task.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "plan_id": {"type": "string", "description": "Plan ID"},
                        "task_id": {"type": "string", "description": "Task ID"},
                    },
                    "required": ["plan_id", "task_id"],
                },
            },
            {
                "name": "complete_task",
                "description": "Mark a task as completed. This unblocks dependent tasks.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "plan_id": {"type": "string", "description": "Plan ID"},
                        "task_id": {"type": "string", "description": "Task ID"},
                        "output_path": {"type": "string", "description": "Path to generated output"},
                        "output_summary": {"type": "string", "description": "Summary of what was generated"},
                    },
                    "required": ["plan_id", "task_id"],
                },
            },
            {
                "name": "fail_task",
                "description": "Mark a task as failed with error details.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "plan_id": {"type": "string", "description": "Plan ID"},
                        "task_id": {"type": "string", "description": "Task ID"},
                        "error": {"type": "string", "description": "Error description"},
                    },
                    "required": ["plan_id", "task_id", "error"],
                },
            },
            {
                "name": "get_build_status",
                "description": "Get current build progress — completed, failed, pending tasks.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "plan_id": {"type": "string", "description": "Plan ID"},
                    },
                    "required": ["plan_id"],
                },
            },
            {
                "name": "get_asset_spec",
                "description": "Get detailed specification for an asset task (3D model, texture, audio, etc.) for AI generation.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "plan_id": {"type": "string", "description": "Plan ID"},
                        "task_id": {"type": "string", "description": "Task ID"},
                    },
                    "required": ["plan_id", "task_id"],
                },
            },
            {
                "name": "list_agent_types",
                "description": "List all available agent types and their capabilities.",
                "inputSchema": {"type": "object", "properties": {}},
            },
        ]

    # ─── Tool Implementations ───

    def parse_game_dna(self, file_path: str) -> dict[str, Any]:
        """Parse a game DNA file and return summary."""
        try:
            dna = load_dna(file_path)
            plan_id = f"plan_{len(self.active_plans)}"
            self.loaded_dna[plan_id] = dna
            return {
                "success": True,
                "plan_id": plan_id,
                "title": dna.title,
                "summary": dna.summary(),
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def generate_build_plan(self, file_path: str, save_plan: str = "") -> dict[str, Any]:
        """Generate a build plan from a GameDNA file."""
        try:
            dna = load_dna(file_path)
            plan = decompose(dna)
            plan_id = f"plan_{len(self.active_plans)}"
            orch = Orchestrator(plan)
            self.active_plans[plan_id] = orch
            self.loaded_dna[plan_id] = dna

            if save_plan:
                orch.save_plan(save_plan)

            stats = plan.stats()
            return {
                "success": True,
                "plan_id": plan_id,
                "game_title": dna.title,
                "total_tasks": stats["total"],
                "by_agent": stats["by_agent"],
                "phases": plan.phases,
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_next_tasks(self, plan_id: str, agent_type: str = "") -> dict[str, Any]:
        """Get tasks ready to execute."""
        orch = self.active_plans.get(plan_id)
        if not orch:
            return {"success": False, "error": f"Plan '{plan_id}' not found"}

        ready = orch.get_ready_tasks()
        if agent_type:
            ready = [t for t in ready if t.agent_type.value == agent_type]

        tasks = []
        for task in ready:
            spec = AGENT_REGISTRY[task.agent_type]
            tasks.append({
                "task_id": task.task_id,
                "agent_type": task.agent_type.value,
                "name": task.name,
                "description": task.description,
                "input_data": task.input_data,
                "tools_required": spec.tools_required,
                "models_required": spec.models_required,
            })

        return {"success": True, "ready_count": len(tasks), "tasks": tasks}

    def get_task_prompt(self, plan_id: str, task_id: str) -> dict[str, Any]:
        """Get the full agent prompt for a task."""
        orch = self.active_plans.get(plan_id)
        if not orch:
            return {"success": False, "error": f"Plan '{plan_id}' not found"}

        task = next((t for t in orch.plan.tasks if t.task_id == task_id), None)
        if not task:
            return {"success": False, "error": f"Task '{task_id}' not found"}

        # Mark dependencies as completed for prompt context
        for dep_id in task.dependencies:
            dep = next((t for t in orch.plan.tasks if t.task_id == dep_id), None)
            if dep and dep.status == TaskStatus.PENDING:
                dep.status = TaskStatus.COMPLETED

        prompt = orch.generate_agent_prompt(task)
        return {"success": True, "task_id": task_id, "prompt": prompt}

    def start_task(self, plan_id: str, task_id: str) -> dict[str, Any]:
        """Mark a task as running."""
        orch = self.active_plans.get(plan_id)
        if not orch:
            return {"success": False, "error": f"Plan '{plan_id}' not found"}

        task = next((t for t in orch.plan.tasks if t.task_id == task_id), None)
        if not task:
            return {"success": False, "error": f"Task '{task_id}' not found"}

        if orch.start_task(task):
            return {"success": True, "status": "running"}
        return {"success": False, "error": f"Task is {task.status.value}, not pending"}

    def complete_task(self, plan_id: str, task_id: str, output_path: str = "", output_summary: str = "") -> dict[str, Any]:
        """Mark a task as completed."""
        orch = self.active_plans.get(plan_id)
        if not orch:
            return {"success": False, "error": f"Plan '{plan_id}' not found"}

        task = next((t for t in orch.plan.tasks if t.task_id == task_id), None)
        if not task:
            return {"success": False, "error": f"Task '{task_id}' not found"}

        orch.complete_task(task, output_path)
        return {
            "success": True,
            "status": "completed",
            "unblocked": len(orch.get_ready_tasks()),
        }

    def fail_task(self, plan_id: str, task_id: str, error: str) -> dict[str, Any]:
        """Mark a task as failed."""
        orch = self.active_plans.get(plan_id)
        if not orch:
            return {"success": False, "error": f"Plan '{plan_id}' not found"}

        task = next((t for t in orch.plan.tasks if t.task_id == task_id), None)
        if not task:
            return {"success": False, "error": f"Task '{task_id}' not found"}

        orch.fail_task(task, error)
        return {"success": True, "status": "failed", "error": error}

    def get_build_status(self, plan_id: str) -> dict[str, Any]:
        """Get build progress."""
        orch = self.active_plans.get(plan_id)
        if not orch:
            return {"success": False, "error": f"Plan '{plan_id}' not found"}

        report = orch.generate_execution_report()
        return {"success": True, **report}

    def get_asset_spec(self, plan_id: str, task_id: str) -> dict[str, Any]:
        """Get detailed asset specification for generation."""
        orch = self.active_plans.get(plan_id)
        if not orch:
            return {"success": False, "error": f"Plan '{plan_id}' not found"}

        task = next((t for t in orch.plan.tasks if t.task_id == task_id), None)
        if not task:
            return {"success": False, "error": f"Task '{task_id}' not found"}

        spec = AGENT_REGISTRY[task.agent_type]
        return {
            "success": True,
            "task_id": task_id,
            "agent_type": task.agent_type.value,
            "agent_name": spec.name,
            "name": task.name,
            "description": task.description,
            "input_data": task.input_data,
            "tools_required": spec.tools_required,
            "models_required": spec.models_required,
            "can_parallelize": spec.can_parallelize,
            "dependencies_met": all(
                next((t for t in orch.plan.tasks if t.task_id == d), None)
                and next((t for t in orch.plan.tasks if t.task_id == d), None).status == TaskStatus.COMPLETED
                for d in task.dependencies
            ),
        }

    def list_agent_types(self) -> dict[str, Any]:
        """List all agent types."""
        agents = []
        for atype, spec in AGENT_REGISTRY.items():
            agents.append({
                "type": atype.value,
                "name": spec.name,
                "description": spec.description,
                "tools": spec.tools_required,
                "models": spec.models_required,
                "parallel": spec.can_parallelize,
                "max_instances": spec.max_instances,
            })
        return {"success": True, "agents": agents}

    def call_tool(self, tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        """Dispatch a tool call."""
        methods = {
            "parse_game_dna": self.parse_game_dna,
            "generate_build_plan": self.generate_build_plan,
            "get_next_tasks": self.get_next_tasks,
            "get_task_prompt": self.get_task_prompt,
            "start_task": self.start_task,
            "complete_task": self.complete_task,
            "fail_task": self.fail_task,
            "get_build_status": self.get_build_status,
            "get_asset_spec": self.get_asset_spec,
            "list_agent_types": self.list_agent_types,
        }

        method = methods.get(tool_name)
        if not method:
            return {"success": False, "error": f"Unknown tool: {tool_name}"}

        try:
            return method(**arguments)
        except TypeError as e:
            return {"success": False, "error": f"Invalid arguments: {e}"}
        except Exception as e:
            return {"success": False, "error": str(e)}


# SSE endpoint for MCP
def create_sse_app(server: HarnessMCPServer):
    """Create a FastAPI app serving MCP over SSE."""
    try:
        from fastapi import FastAPI, Request
        from fastapi.responses import StreamingResponse
        import asyncio
    except ImportError:
        raise ImportError("Install fastapi and uvicorn: pip install fastapi uvicorn sse-starlette")

    app = FastAPI(title="ForgeDNA Harness MCP Server")

    @app.get("/sse")
    async def sse_endpoint(request: Request):
        """SSE endpoint for MCP communication."""
        async def event_generator():
            # Send server info
            yield f"data: {json.dumps({'type': 'server_info', 'name': 'forgedna-harness', 'version': '0.1.0'})}\n\n"

        return StreamingResponse(event_generator(), media_type="text/event-stream")

    @app.get("/tools")
    async def list_tools():
        """List available tools."""
        return server.get_tools()

    @app.post("/call")
    async def call_tool(request: Request):
        """Call a tool."""
        body = await request.json()
        tool_name = body.get("tool", "")
        arguments = body.get("arguments", {})
        return server.call_tool(tool_name, arguments)

    @app.post("/tools/{tool_name}")
    async def call_tool_direct(tool_name: str, request: Request):
        """Call a tool directly by name."""
        arguments = await request.json()
        return server.call_tool(tool_name, arguments)

    return app
