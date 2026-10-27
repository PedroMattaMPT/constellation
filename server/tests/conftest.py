from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

from constellation.claude.files import proc_start, transcript_path

FIXTURES = Path(__file__).resolve().parents[2] / "research" / "fixtures"
TRANSCRIPTS = FIXTURES / "transcripts"


class FakeClaude:
    """A ~/.claude folder with registry entries for real, live processes (so liveness checks pass)."""

    def __init__(self, root: Path):
        self.root = root
        (root / "sessions").mkdir(parents=True)
        self.children: list[subprocess.Popen] = []

    def process(self) -> int:
        child = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"])
        self.children.append(child)
        return child.pid

    def register(
        self, pid: int, session_id: str, name: str, cwd: str = "/lab/a", status: str = "idle", **extra
    ) -> dict:
        entry = {
            "pid": pid,
            "procStart": proc_start(pid),
            "sessionId": session_id,
            "cwd": cwd,
            "name": name,
            "kind": "interactive",
            "status": status,
            "startedAt": 1,
            "statusUpdatedAt": 1,
            **extra,
        }
        (self.root / "sessions" / f"{pid}.json").write_text(json.dumps(entry))
        return entry

    def unregister(self, pid: int) -> None:
        (self.root / "sessions" / f"{pid}.json").unlink()

    def transcript(self, cwd: str, session_id: str, fixture: str | None = None) -> Path:
        path = transcript_path(cwd, session_id, self.root)
        path.parent.mkdir(parents=True, exist_ok=True)
        if fixture:
            shutil.copy(TRANSCRIPTS / fixture, path)
        return path

    def close(self) -> None:
        for child in self.children:
            child.kill()
            child.wait()


@pytest.fixture
def claude(tmp_path: Path):
    fake = FakeClaude(tmp_path / ".claude")
    yield fake
    fake.close()


@pytest.fixture
def me() -> int:
    return os.getpid()


@pytest.fixture(autouse=True)
def own_settings(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Your own ~/.config/constellation stays out of the tests."""
    monkeypatch.setenv("XDG_CONFIG_HOME", str(tmp_path / "config"))
