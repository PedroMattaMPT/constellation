"""Messages to sessions Constellation didn't start, over Claude Code's inbox sockets (docs/data-sources.md §4).

A message is one JSON line on the session's socket. It arrives as from another session named
`constellation`, never as from you: it can't run slash commands or answer prompts. Constellation binds its own
socket next to Claude Code's, so a session can reply; replies are kept here, and they show in the session's
own transcript as a sent message.

The format is undocumented: Constellation only sends to sessions that say they speak protocol 1.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import os
import time
import uuid
from collections import deque
from pathlib import Path

from .claude import files

log = logging.getLogger(__name__)

NAME = "constellation"
PROTOCOL = 1
WRAP = (
    '<cross-session-message from="{address}" from-name="{name}" from-mode="prompting">\n'
    "{body}\n"
    "</cross-session-message>"
)


class InboxError(Exception):
    pass


class Inbox:
    def __init__(self, directory: Path | None = None) -> None:
        self.directory = directory or files.runtime_dir() / "cc-socks"
        self.path = self.directory / f"{NAME}-{os.getpid()}.sock"
        self.received: deque[dict] = deque(maxlen=200)
        self._server: asyncio.Server | None = None

    @property
    def address(self) -> str:
        return f"uds:{self.path}"

    async def start(self) -> None:
        self.directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        with contextlib.suppress(FileNotFoundError):
            self.path.unlink()
        self._server = await asyncio.start_unix_server(self._accept, path=str(self.path))
        os.chmod(self.path, 0o600)

    async def close(self) -> None:
        if self._server:
            self._server.close()
            await self._server.wait_closed()
        with contextlib.suppress(FileNotFoundError):
            self.path.unlink()

    async def _accept(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        try:
            while line := await reader.readline():
                with contextlib.suppress(ValueError):
                    message = json.loads(line)
                    if isinstance(message, dict):
                        self.received.append({"at": int(time.time() * 1000), **message})
        finally:
            writer.close()

    async def send(self, socket_path: str, text: str) -> str:
        """One message to a session's inbox. Returns its msg_id, which the receiver's transcript keeps."""
        body = text.replace("</cross-session-message", "<\\/cross-session-message")  # can't close the wrapper
        msg_id = str(uuid.uuid4())
        message = {
            "msgV": PROTOCOL,
            "msg_id": msg_id,
            "type": "user",
            "message": {"role": "user", "content": WRAP.format(address=self.address, name=NAME, body=body)},
            "priority": "next",
            "from": self.address,
        }
        try:
            _, writer = await asyncio.wait_for(asyncio.open_unix_connection(socket_path), 3)
        except (OSError, TimeoutError) as error:
            raise InboxError(f"its inbox didn't answer: {error}") from error
        try:
            writer.write(json.dumps(message).encode() + b"\n")
            await writer.drain()
        finally:
            writer.close()
            with contextlib.suppress(OSError):
                await writer.wait_closed()
        return msg_id


def reachable(registry: dict) -> bool:
    """A session Constellation can message: it has an inbox, and speaks the protocol this was checked on."""
    return bool(registry.get("messagingSocketPath")) and registry.get("peerProtocol") == PROTOCOL
