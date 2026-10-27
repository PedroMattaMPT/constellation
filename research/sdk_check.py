#!/usr/bin/env python3
"""Roadmap 3.1: what the Claude Agent SDK (Python) can do with your own Claude Code setup.

Starts one SDK session in a throwaway lab folder, with your settings, login, CLAUDE.md, skills,
plugins and MCP servers, and runs every check in ROADMAP.md 3.1 against it. Each check records what
happened, not what was expected; docs/sdk-check.md has the verdicts.

The session runs on Claude Haiku 5.5 with low effort to keep it cheap, and asks only harmless
things. Files it writes stay in the lab folder. Nothing changes your global settings: /config is
only opened, never set.

    uv run --project server python research/sdk_check.py LAB_DIR OUT.json [CHECK ...]

Name checks after OUT.json to run only those (setup always runs).
"""

from __future__ import annotations

import asyncio
import base64
import json
import shutil
import struct
import subprocess
import sys
import time
import zlib
from pathlib import Path
from typing import Any

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    ClaudeSDKClient,
    ConversationResetMessage,
    PermissionResultAllow,
    PermissionResultDeny,
    ResultMessage,
    SystemMessage,
    TextBlock,
    ToolPermissionContext,
    ToolUseBlock,
    UserMessage,
    fork_session,
    get_session_messages,
    list_sessions,
    rename_session,
    tag_session,
)

MODEL = "claude-haiku-5-5"
OTHER_MODEL = "claude-sonnet-5-5"
CLAUDE = Path.home() / ".claude"
TURN_TIMEOUT = 180


def red_square_png(size: int = 16) -> bytes:
    """A plain red PNG, built by hand so the check needs no imaging library."""
    row = b"\x00" + b"\xff\x00\x00" * size
    raw = row * size

    def chunk(kind: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + kind
            + data
            + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
        )

    header = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )


def make_lab(lab: Path) -> None:
    """A project folder with its own CLAUDE.md and skill, so loading them is observable."""
    (lab / ".claude" / "skills" / "lab-echo").mkdir(parents=True, exist_ok=True)
    (lab / "CLAUDE.md").write_text("# Lab\n\nThe lab marker word is NEBULA-7.\n")
    (lab / ".claude" / "skills" / "lab-echo" / "SKILL.md").write_text(
        "---\nname: lab-echo\ndescription: Constellation lab check. Replies with a fixed marker.\n---\n\n"
        "Reply with exactly this and nothing else: LAB-SKILL-OK\n"
    )


def describe(message: Any) -> dict[str, Any]:
    """One stream message, reduced to what the checks look at."""
    if isinstance(message, AssistantMessage):
        blocks = []
        for block in message.content:
            if isinstance(block, TextBlock):
                blocks.append({"text": block.text[:300]})
            elif isinstance(block, ToolUseBlock):
                blocks.append(
                    {"tool": block.name, "input": json.dumps(block.input)[:300]}
                )
        return {
            "type": "assistant",
            "model": message.model,
            "blocks": blocks,
            "error": message.error,
        }
    if isinstance(message, UserMessage):
        content = (
            message.content
            if isinstance(message.content, str)
            else [type(b).__name__ for b in message.content]
        )
        return {"type": "user", "uuid": message.uuid, "content": str(content)[:300]}
    if isinstance(message, ConversationResetMessage):
        return {
            "type": "reset",
            "new_conversation_id": message.new_conversation_id,
            "session_id": message.session_id,
        }
    if isinstance(message, SystemMessage):
        return {
            "type": "system",
            "subtype": message.subtype,
            "data": json.dumps(message.data)[:400],
        }
    if isinstance(message, ResultMessage):
        return {
            "type": "result",
            "subtype": message.subtype,
            "is_error": message.is_error,
            "stop_reason": message.stop_reason,
            "terminal_reason": message.terminal_reason,
            "cost_usd": message.total_cost_usd,
            "session_id": message.session_id,
            "result": (message.result or "")[:300],
            "permission_denials": message.permission_denials,
        }
    return {"type": type(message).__name__}


class Lab:
    def __init__(self, lab: Path) -> None:
        self.lab = lab
        self.report: dict[str, Any] = {}
        self.permission_calls: list[dict[str, Any]] = []
        # How the permission callback answers the next request, per tool. Set by each check.
        self.policy: dict[str, str] = {}
        self.init: dict[str, Any] | None = None
        self.only: set[str] = set()

    async def can_use_tool(
        self, tool: str, tool_input: dict[str, Any], context: ToolPermissionContext
    ):
        call = {
            "tool": tool,
            "input": json.dumps(tool_input)[:500],
            "suggestions": [str(s)[:300] for s in context.suggestions],
            "decision_reason": context.decision_reason,
            "policy": self.policy.get(tool, "allow"),
        }
        self.permission_calls.append(call)
        policy = self.policy.get(tool, "allow")
        if policy == "deny":
            return PermissionResultDeny(message="denied by the Constellation lab")
        if policy == "change" and tool == "Write":
            return PermissionResultAllow(
                updated_input={**tool_input, "content": "changed by constellation\n"}
            )
        if policy == "answer" and tool == "AskUserQuestion":
            answers = {
                q["question"]: q["options"][-1]["label"]
                for q in tool_input.get("questions", [])
            }
            call["answers"] = answers
            return PermissionResultAllow(
                updated_input={**tool_input, "answers": answers}
            )
        if policy == "remember":
            return PermissionResultAllow(updated_permissions=list(context.suggestions))
        return PermissionResultAllow()

    async def turn(
        self, client: ClaudeSDKClient, prompt: Any, interrupt_after: float | None = None
    ) -> list[dict[str, Any]]:
        """Send one prompt and collect everything up to its result."""
        seen: list[dict[str, Any]] = []

        async def collect() -> None:
            async for message in client.receive_response():
                if isinstance(message, SystemMessage) and message.subtype == "init":
                    self.init = message.data
                seen.append(describe(message))

        await client.query(prompt)
        task = asyncio.create_task(collect())
        if interrupt_after is not None:
            await asyncio.sleep(interrupt_after)
            await client.interrupt()
            seen.append(
                {"type": "note", "text": f"interrupt sent after {interrupt_after}s"}
            )
        await asyncio.wait_for(task, TURN_TIMEOUT)
        return seen

    async def check(self, name: str, step) -> None:
        if self.only and name not in self.only and name != "setup":
            return
        started = time.monotonic()
        calls_before = len(self.permission_calls)
        try:
            self.report[name] = await step()
        except Exception as error:  # noqa: BLE001 - every check reports, none stops the run
            self.report[name] = {"error": f"{type(error).__name__}: {error}"}
        self.report[name] = {
            "result": self.report[name],
            "permission_calls": self.permission_calls[calls_before:],
            "seconds": round(time.monotonic() - started, 1),
        }
        print(f"{name}: done in {self.report[name]['seconds']}s", file=sys.stderr)


def registry_entries(lab: Path) -> list[dict[str, Any]]:
    entries = []
    for path in (CLAUDE / "sessions").glob("*.json"):
        try:
            data = json.loads(path.read_text())
        except (OSError, json.JSONDecodeError):
            continue
        if data.get("cwd") == str(lab):
            entries.append(data)
    return entries


def transcript_dir(lab: Path) -> Path:
    return CLAUDE / "projects" / "".join(c if c.isalnum() else "-" for c in str(lab))


def agents_list() -> list[dict[str, Any]]:
    try:
        out = subprocess.run(
            ["claude", "agents", "--json", "--all"],
            check=False,
            capture_output=True,
            text=True,
            timeout=30,
        )
        return json.loads(out.stdout or "[]")
    except (OSError, subprocess.TimeoutExpired, json.JSONDecodeError) as error:
        return [{"error": str(error)}]


async def run(
    lab: Path, cli: str | None, version: str, only: set[str]
) -> dict[str, Any]:
    make_lab(lab)
    state = Lab(lab)
    state.only = only
    options = ClaudeAgentOptions(
        cwd=str(lab),
        model=MODEL,
        effort="low",
        setting_sources=["user", "project", "local"],
        permission_mode="default",
        can_use_tool=state.can_use_tool,
        cli_path=cli,
        stderr=lambda line: None,
    )
    state.report["cli"] = {"path": cli, "version": version}

    async with ClaudeSDKClient(options) as client:
        session_id: dict[str, str] = {}

        async def setup():
            seen = await state.turn(
                client,
                "What is the lab marker word from CLAUDE.md? Reply with the word only.",
            )
            info = await client.get_server_info() or {}
            init = state.init or {}
            result = next((m for m in seen if m["type"] == "result"), {})
            session_id["id"] = result.get("session_id", "")
            return {
                "reply": seen,
                "init": {
                    "claude_code_version": init.get("claude_code_version"),
                    "model": init.get("model"),
                    "permissionMode": init.get("permissionMode"),
                    "apiKeySource": init.get("apiKeySource"),
                    "tools": len(init.get("tools", [])),
                    "skills": len(init.get("skills", [])),
                    "lab_skill_listed": "lab-echo" in init.get("skills", []),
                    "slash_commands": len(init.get("slash_commands", [])),
                    "plugins": [p.get("name") for p in init.get("plugins", [])],
                    "plugin_errors": init.get("plugin_errors"),
                    "mcp_servers": [
                        {"name": s.get("name"), "status": s.get("status")}
                        for s in init.get("mcp_servers", [])
                    ],
                },
                "server_info_keys": sorted(info.keys()),
                "server_info_models": info.get("models"),
                "server_info_commands": len(info.get("commands", [])),
            }

        await state.check("setup", setup)

        async def visibility():
            await asyncio.sleep(1)
            entries = registry_entries(lab)
            sid = session_id.get("id", "")
            transcript = transcript_dir(lab) / f"{sid}.jsonl"
            agents = agents_list()
            return {
                "registry": entries,
                "transcript_exists": transcript.exists(),
                "transcript_lines": len(transcript.read_text().splitlines())
                if transcript.exists()
                else 0,
                "in_claude_agents": [
                    a
                    for a in agents
                    if isinstance(a, dict) and str(lab) in json.dumps(a)
                ],
            }

        await state.check("visibility", visibility)

        async def context_usage():
            usage = await client.get_context_usage()
            return {
                "totalTokens": usage.get("totalTokens"),
                "maxTokens": usage.get("maxTokens"),
                "percentage": usage.get("percentage"),
                "model": usage.get("model"),
                "categories": [
                    (c["name"], c["tokens"]) for c in usage.get("categories", [])
                ],
                "memoryFiles": [m.get("path") for m in usage.get("memoryFiles", [])],
                "mcpTools": len(usage.get("mcpTools", [])),
            }

        await state.check("get_context_usage", context_usage)

        async def mcp_status():
            status = await client.get_mcp_status()
            return [
                {
                    "name": s.get("name"),
                    "status": s.get("status"),
                    "tools": len(s.get("tools", [])),
                }
                for s in status.get("mcpServers", [])
            ]

        await state.check("get_mcp_status", mcp_status)

        async def set_model():
            await client.set_model(OTHER_MODEL)
            seen = await state.turn(client, "Reply with the word ok.")
            await client.set_model(MODEL)
            back = await state.turn(client, "Reply with the word ok.")
            return {"after_switch": seen, "after_switch_back": back}

        await state.check("set_model", set_model)

        async def plan_mode():
            await client.set_permission_mode("plan")
            state.policy = {"ExitPlanMode": "deny"}
            seen = await state.turn(
                client, "Create a file named plan.txt containing the word x."
            )
            await client.set_permission_mode("default")
            state.policy = {}
            return {"reply": seen, "plan_txt_exists": (lab / "plan.txt").exists()}

        await state.check("set_permission_mode", plan_mode)

        async def interrupt():
            seen = await state.turn(
                client,
                "Write the numbers 1 to 400, one per line, with no other text.",
                interrupt_after=2.0,
            )
            after = await state.turn(client, "Reply with the word ok.")
            return {"interrupted": seen, "next_turn": after}

        await state.check("interrupt", interrupt)

        async def permission_allow_with_changes():
            state.policy = {"Write": "change"}
            seen = await state.turn(
                client,
                "Use the Write tool to create lab.txt containing exactly: hello from the lab",
            )
            state.policy = {}
            path = lab / "lab.txt"
            return {"reply": seen, "file": path.read_text() if path.exists() else None}

        await state.check(
            "permission_allow_with_changes", permission_allow_with_changes
        )

        async def permission_deny():
            state.policy = {"Bash": "deny"}
            seen = await state.turn(
                client,
                "Run this exact shell command with the Bash tool: touch lab-denied.txt",
            )
            state.policy = {}
            return {"reply": seen}

        await state.check("permission_deny", permission_deny)

        async def permission_remember():
            state.policy = {"Bash": "remember"}
            first = await state.turn(
                client,
                "Run this exact shell command with the Bash tool: touch lab-remembered.txt",
            )
            state.policy = {}
            calls = len(state.permission_calls)
            second = await state.turn(
                client, "Run the same command again: touch lab-remembered.txt"
            )
            local = lab / ".claude" / "settings.local.json"
            return {
                "first": first,
                "second": second,
                "asked_again": len(state.permission_calls) > calls,
                "settings_local": local.read_text() if local.exists() else None,
            }

        await state.check("permission_remember", permission_remember)

        async def question():
            state.policy = {"AskUserQuestion": "answer"}
            seen = await state.turn(
                client,
                "Use the AskUserQuestion tool to ask me one question: which color do I prefer, with the options red and "
                "blue. Then reply with only the color I chose.",
            )
            state.policy = {}
            return {"reply": seen}

        await state.check("question", question)

        async def image():
            data = base64.b64encode(red_square_png()).decode()

            async def message():
                yield {
                    "type": "user",
                    "message": {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/png",
                                    "data": data,
                                },
                            },
                            {
                                "type": "text",
                                "text": "What color is this square? Reply with one word.",
                            },
                        ],
                    },
                    "parent_tool_use_id": None,
                }

            return await state.turn(client, message())

        await state.check("image", image)

        for name, prompt in [
            ("command_skill", "/lab-echo"),
            ("command_effort", "/effort medium"),
            ("command_config_open", "/config"),
            ("command_compact", "/compact"),
        ]:

            async def command(prompt=prompt):
                return await state.turn(client, prompt)

            await state.check(name, command)

        async def after_compact():
            usage = await client.get_context_usage()
            return {
                "totalTokens": usage.get("totalTokens"),
                "percentage": usage.get("percentage"),
            }

        await state.check("context_after_compact", after_compact)

        async def clear():
            seen = await state.turn(client, "/clear")
            after = await state.turn(
                client,
                "What is the lab marker word from CLAUDE.md? Reply with the word only.",
            )
            await asyncio.sleep(1)
            return {
                "clear": seen,
                "next_turn": after,
                "registry": registry_entries(lab),
            }

        await state.check("command_clear", clear)

    # Offline helpers: they read and write the transcript files, no running session needed.
    sid = session_id.get("id", "")

    async def helpers():
        listed = list_sessions(directory=str(lab))
        messages = get_session_messages(sid, directory=str(lab), limit=5) if sid else []
        rename_session(sid, "sdk-lab renamed", directory=str(lab))
        tag_session(sid, "constellation-lab", directory=str(lab))
        relisted = list_sessions(directory=str(lab))
        fork = fork_session(sid, directory=str(lab), title="sdk-lab fork")
        return {
            "listed": [str(s)[:300] for s in listed],
            "first_messages": [str(m)[:200] for m in messages],
            "after_rename_and_tag": [str(s)[:300] for s in relisted],
            "fork": str(fork)[:300],
        }

    await state.check("session_helpers", helpers)
    await asyncio.sleep(2)
    state.report["registry_after_exit"] = registry_entries(lab)
    return state.report


def main() -> None:
    lab, out = Path(sys.argv[1]).resolve(), Path(sys.argv[2])
    lab.mkdir(parents=True, exist_ok=True)
    cli = shutil.which("claude")
    version = subprocess.run(
        [cli or "claude", "--version"], check=False, capture_output=True, text=True
    ).stdout.strip()
    report = asyncio.run(run(lab, cli, version, set(sys.argv[3:])))
    out.write_text(json.dumps(report, indent=2, default=str))
    print(f"wrote {out}", file=sys.stderr)


if __name__ == "__main__":
    main()
