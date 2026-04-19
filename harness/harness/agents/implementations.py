"""Concrete agent implementations — subprocess, API, HF, MCP."""
import json
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from . import AgentConfig, AgentProtocol, AgentBackend, TaskResult, list_generated_files


class SubprocessAgent(AgentProtocol):
    """Dispatches tasks to a CLI agent (Claude Code, Codex, custom scripts)."""

    def __init__(self, config: AgentConfig):
        self.config = config

    def is_available(self) -> bool:
        if not self.config.command:
            return False
        # Check if command exists on PATH
        from shutil import which
        return which(self.config.command.split()[0]) is not None

    def dispatch(self, task_prompt: str, output_dir: str, context: dict[str, Any] = None) -> TaskResult:
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        # Snapshot files before dispatch
        files_before = set(list_generated_files(output_dir))

        # Write task prompt to a temp file (some agents read from stdin/file)
        prompt_file = output_path / ".forgedna_task_prompt.md"
        prompt_file.write_text(task_prompt)

        # Build command
        cmd = [self.config.command] + self.config.args_template

        # Set up environment
        env = os.environ.copy()
        env.update(self.config.env_vars)
        env["FORGEDNA_OUTPUT_DIR"] = str(output_path)
        env["FORGEDNA_TASK_PROMPT"] = str(prompt_file)

        try:
            result = subprocess.run(
                cmd,
                input=task_prompt,
                capture_output=True,
                text=True,
                timeout=self.config.timeout,
                cwd=str(output_path),
                env=env,
            )

            # Snapshot files after dispatch
            files_after = set(list_generated_files(output_dir))
            new_files = list(files_after - files_before)

            # Clean up prompt file
            if prompt_file.exists():
                prompt_file.unlink()

            if result.returncode == 0:
                return TaskResult(
                    success=True,
                    task_id=context.get("task_id", "") if context else "",
                    output_files=new_files,
                    output_text=result.stdout[:5000],
                    metadata={"command": cmd[0], "return_code": result.returncode},
                )
            else:
                return TaskResult(
                    success=False,
                    task_id=context.get("task_id", "") if context else "",
                    output_files=new_files,
                    error=result.stderr[:3000] or f"Exit code {result.returncode}",
                    output_text=result.stdout[:3000],
                    metadata={"command": cmd[0], "return_code": result.returncode},
                )

        except subprocess.TimeoutExpired:
            return TaskResult(
                success=False,
                task_id=context.get("task_id", "") if context else "",
                error=f"Agent timed out after {self.config.timeout}s",
            )
        except Exception as e:
            return TaskResult(
                success=False,
                task_id=context.get("task_id", "") if context else "",
                error=str(e),
            )


class APIAgent(AgentProtocol):
    """Dispatches tasks to LLM APIs directly (OpenAI, Anthropic, etc.)."""

    def __init__(self, config: AgentConfig):
        self.config = config

    def is_available(self) -> bool:
        if not self.config.api_key_env:
            return False
        return bool(os.environ.get(self.config.api_key_env))

    def dispatch(self, task_prompt: str, output_dir: str, context: dict[str, Any] = None) -> TaskResult:
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        api_key = os.environ.get(self.config.api_key_env, "")
        if not api_key:
            return TaskResult(
                success=False,
                task_id=context.get("task_id", "") if context else "",
                error=f"API key not set: {self.config.api_key_env}",
            )

        try:
            if self.config.api_provider == "openai":
                return self._call_openai(task_prompt, output_path, api_key, context)
            elif self.config.api_provider == "anthropic":
                return self._call_anthropic(task_prompt, output_path, api_key, context)
            else:
                return self._call_generic_api(task_prompt, output_path, api_key, context)
        except Exception as e:
            return TaskResult(
                success=False,
                task_id=context.get("task_id", "") if context else "",
                error=str(e),
            )

    def _call_openai(self, prompt: str, output_dir: Path, api_key: str, context: dict) -> TaskResult:
        import urllib.request

        url = self.config.api_base_url or "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": self.config.api_model,
            "messages": [
                {"role": "system", "content": "You are an expert game developer. Generate complete, production-ready code files. Return code in markdown code blocks with filenames as headers (```filename.gd)."},
                {"role": "user", "content": prompt},
            ],
            "max_tokens": 8000,
            "temperature": 0.7,
        }

        req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers)
        with urllib.request.urlopen(req, timeout=self.config.timeout) as resp:
            data = json.loads(resp.read())

        content = data["choices"][0]["message"]["content"]
        files = self._extract_code_files(content, output_dir)

        return TaskResult(
            success=True,
            task_id=context.get("task_id", "") if context else "",
            output_files=files,
            output_text=content[:3000],
            metadata={"model": self.config.api_model, "tokens": data.get("usage", {})},
        )

    def _call_anthropic(self, prompt: str, output_dir: Path, api_key: str, context: dict) -> TaskResult:
        import urllib.request

        url = self.config.api_base_url or "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }
        body = {
            "model": self.config.api_model,
            "max_tokens": 8000,
            "system": "You are an expert game developer. Generate complete, production-ready code files. Return code in markdown code blocks with filenames as headers (```filename.gd).",
            "messages": [{"role": "user", "content": prompt}],
        }

        req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers)
        with urllib.request.urlopen(req, timeout=self.config.timeout) as resp:
            data = json.loads(resp.read())

        content = data["content"][0]["text"]
        files = self._extract_code_files(content, output_dir)

        return TaskResult(
            success=True,
            task_id=context.get("task_id", "") if context else "",
            output_files=files,
            output_text=content[:3000],
            metadata={"model": self.config.api_model, "tokens": data.get("usage", {})},
        )

    def _call_generic_api(self, prompt: str, output_dir: Path, api_key: str, context: dict) -> TaskResult:
        """Generic OpenAI-compatible API call."""
        import urllib.request

        url = self.config.api_base_url
        if not url:
            return TaskResult(success=False, task_id="", error="No API base URL configured")

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": self.config.api_model,
            "messages": [
                {"role": "system", "content": "You are an expert game developer. Generate complete code. Return code in markdown blocks with filenames."},
                {"role": "user", "content": prompt},
            ],
            "max_tokens": 8000,
        }

        req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers)
        with urllib.request.urlopen(req, timeout=self.config.timeout) as resp:
            data = json.loads(resp.read())

        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        files = self._extract_code_files(content, output_dir)

        return TaskResult(
            success=True,
            task_id=context.get("task_id", "") if context else "",
            output_files=files,
            output_text=content[:3000],
        )

    def _extract_code_files(self, content: str, output_dir: Path) -> list[str]:
        """Extract code blocks from markdown and write them as files."""
        import re
        files = []
        # Match ```filename.ext ... ``` blocks
        pattern = r"```(?:([a-zA-Z0-9_./\\-]+\.[a-zA-Z0-9]+))?\s*\n(.*?)```"
        for match in re.finditer(pattern, content, re.DOTALL):
            filename = match.group(1)
            code = match.group(2)
            if filename:
                filepath = output_dir / filename
                filepath.parent.mkdir(parents=True, exist_ok=True)
                filepath.write_text(code)
                files.append(filename)
            elif code.strip():
                # Code block without filename — save as generic
                filepath = output_dir / f"generated_{len(files)}.gd"
                filepath.write_text(code)
                files.append(filepath.name)
        return files


class HFAgent(AgentProtocol):
    """Dispatches tasks to Hugging Face models (image, audio generation)."""

    def __init__(self, config: AgentConfig):
        self.config = config

    def is_available(self) -> bool:
        if not self.config.hf_model:
            return False
        token_env = self.config.hf_token_env
        return bool(os.environ.get(token_env))

    def dispatch(self, task_prompt: str, output_dir: str, context: dict[str, Any] = None) -> TaskResult:
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        token = os.environ.get(self.config.hf_token_env, "")
        task_id = context.get("task_id", "") if context else ""
        asset_name = context.get("asset_name", task_id) if context else task_id

        try:
            if self.config.hf_task == "text-to-image":
                return self._generate_image(task_prompt, output_path, token, asset_name, task_id)
            elif self.config.hf_task == "text-to-audio":
                return self._generate_audio(task_prompt, output_path, token, asset_name, task_id)
            else:
                return TaskResult(
                    success=False, task_id=task_id,
                    error=f"Unsupported HF task: {self.config.hf_task}",
                )
        except Exception as e:
            return TaskResult(success=False, task_id=task_id, error=str(e))

    def _generate_image(self, prompt: str, output_dir: Path, token: str, name: str, task_id: str) -> TaskResult:
        import urllib.request

        url = f"https://api-inference.huggingface.co/models/{self.config.hf_model}"
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        body = {"inputs": prompt}

        req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers)
        with urllib.request.urlopen(req, timeout=self.config.timeout) as resp:
            image_data = resp.read()

        filename = f"{name}.png"
        filepath = output_dir / filename
        filepath.write_bytes(image_data)

        return TaskResult(
            success=True, task_id=task_id,
            output_files=[filename],
            metadata={"model": self.config.hf_model, "size_bytes": len(image_data)},
        )

    def _generate_audio(self, prompt: str, output_dir: Path, token: str, name: str, task_id: str) -> TaskResult:
        import urllib.request

        url = f"https://api-inference.huggingface.co/models/{self.config.hf_model}"
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        body = {"inputs": prompt}

        req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers)
        with urllib.request.urlopen(req, timeout=self.config.timeout) as resp:
            audio_data = resp.read()

        filename = f"{name}.wav"
        filepath = output_dir / filename
        filepath.write_bytes(audio_data)

        return TaskResult(
            success=True, task_id=task_id,
            output_files=[filename],
            metadata={"model": self.config.hf_model, "size_bytes": len(audio_data)},
        )


class MCPAgent(AgentProtocol):
    """Dispatches tasks to an MCP server endpoint."""

    def __init__(self, config: AgentConfig):
        self.config = config

    def is_available(self) -> bool:
        if not self.config.mcp_url:
            return False
        try:
            import urllib.request
            req = urllib.request.Request(f"{self.config.mcp_url}/tools")
            with urllib.request.urlopen(req, timeout=5) as resp:
                return resp.status == 200
        except Exception:
            return False

    def dispatch(self, task_prompt: str, output_dir: str, context: dict[str, Any] = None) -> TaskResult:
        import urllib.request

        task_id = context.get("task_id", "") if context else ""
        agent_type = context.get("agent_type", "") if context else ""

        try:
            url = f"{self.config.mcp_url}/call"
            headers = {"Content-Type": "application/json"}
            body = {
                "tool": "execute_task",
                "arguments": {
                    "prompt": task_prompt,
                    "output_dir": output_dir,
                    "agent_type": agent_type,
                    "task_id": task_id,
                },
            }

            req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers)
            with urllib.request.urlopen(req, timeout=self.config.timeout) as resp:
                data = json.loads(resp.read())

            if data.get("success"):
                return TaskResult(
                    success=True, task_id=task_id,
                    output_files=data.get("output_files", []),
                    output_text=data.get("output_text", ""),
                    metadata=data.get("metadata", {}),
                )
            else:
                return TaskResult(
                    success=False, task_id=task_id,
                    error=data.get("error", "Unknown MCP error"),
                )

        except Exception as e:
            return TaskResult(success=False, task_id=task_id, error=str(e))


class DryRunAgent(AgentProtocol):
    """Simulates an agent without actually doing anything."""

    def __init__(self, config: AgentConfig = None):
        self.config = config or AgentConfig(name="dry-run", backend=AgentBackend.DRY_RUN)

    def is_available(self) -> bool:
        return True

    def dispatch(self, task_prompt: str, output_dir: str, context: dict[str, Any] = None) -> TaskResult:
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        task_id = context.get("task_id", "") if context else ""
        agent_type = context.get("agent_type", "") if context else ""

        # Create a placeholder file
        placeholder = output_path / f"{task_id}.placeholder"
        placeholder.write_text(f"# Dry run placeholder for {task_id}\n# Agent type: {agent_type}\n")

        return TaskResult(
            success=True,
            task_id=task_id,
            output_files=[f"{task_id}.placeholder"],
            output_text=f"[DRY RUN] Would execute task {task_id} via {agent_type}",
            metadata={"dry_run": True},
        )
