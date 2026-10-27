"""Paths for the prompt box and the launcher: folder completion, and files for `@` mentions."""

from __future__ import annotations

import os
import subprocess
import time
from pathlib import Path

from .protocol import FileMatch, FileMatches, FolderMatches

FOLDERS_MAX = 12
FILES_MAX = 20
LIST_MAX = 50_000  # files listed per project; a bigger tree is cut there
LIST_TTL_S = 10.0  # a project's file list is reused for this long: one listing per mention, not per key
SKIP_DIRS = {".git", "node_modules", ".venv", "__pycache__", "dist", "build", ".next", ".cache"}
_listed: dict[str, tuple[float, list[str]]] = {}


def folders(partial: str) -> FolderMatches:
    """The folders that complete `partial`, written the way it was (`~/…` stays `~/…`)."""
    raw = partial.strip() or "~/"
    home = str(Path.home())
    expanded = os.path.expanduser(raw)
    path = Path(expanded)
    head, _, stem = expanded.rpartition("/")  # by hand: pathlib would drop a trailing "." (`~/code/.` → hidden folders)
    parent = Path(head or "/")
    found = []
    try:
        for child in sorted(parent.iterdir(), key=lambda p: p.name.lower()):
            if child.name.startswith(".") and not stem.startswith("."):
                continue
            if child.name.lower().startswith(stem.lower()) and child.is_dir():
                shown = str(child)
                if raw.startswith("~") and shown.startswith(home):
                    shown = "~" + shown[len(home) :]
                found.append(shown + "/")
    except OSError:
        pass
    return FolderMatches(folder=path.is_dir(), matches=found[:FOLDERS_MAX], total=len(found))


def _list(cwd: str) -> list[str]:
    """Every file in the project, relative to it: git's own list when it's a repository (ignored files stay out)."""
    cached = _listed.get(cwd)
    if cached and time.monotonic() - cached[0] < LIST_TTL_S:
        return cached[1]
    files: list[str] = []
    try:
        done = subprocess.run(
            ["git", "-C", cwd, "ls-files", "--cached", "--others", "--exclude-standard"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if done.returncode == 0:
            files = done.stdout.splitlines()[:LIST_MAX]
    except (OSError, subprocess.TimeoutExpired):
        pass
    if not files:
        for root, dirs, names in os.walk(cwd):
            dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS and not d.startswith("."))
            rel = os.path.relpath(root, cwd)
            files.extend(name if rel == "." else f"{rel}/{name}" for name in sorted(names))
            if len(files) >= LIST_MAX:
                break
    _listed[cwd] = (time.monotonic(), files)
    return files


def _score(path: str, query: str) -> int | None:
    """Lower is better: the name starts with it, the name has it, the path has it, the letters come in order."""
    name = path.rstrip("/").rsplit("/", 1)[-1].lower()
    lower = path.lower()
    if name.startswith(query):
        return 0
    if query in name:
        return 1
    if query in lower:
        return 2
    at = 0
    for char in query:
        at = lower.find(char, at) + 1
        if at == 0:
            return None
    return 3


def files(cwd: str, query: str) -> FileMatches:
    """Files and folders of the project for `@query`, best first."""
    listed = _list(cwd)
    folders_seen = set()
    for path in listed:  # every folder on the way to a file, so `src/` shows even with no file of its own
        parts = path.split("/")[:-1]
        folders_seen.update("/".join(parts[: i + 1]) + "/" for i in range(len(parts)))
    q = query.lower().lstrip("./")
    candidates = [*sorted(folders_seen), *listed]
    if q:
        scored = [(s, len(p), p) for p in candidates if (s := _score(p, q)) is not None]
    else:  # nothing typed yet: the project's top folders, then its top files
        top = [p for p in candidates if p.count("/") == (1 if p.endswith("/") else 0)]
        scored = [(0 if p.endswith("/") else 1, 0, p) for p in top]  # by name
    scored.sort()
    return FileMatches(
        matches=[FileMatch(path=p, folder=p.endswith("/")) for _, _, p in scored[:FILES_MAX]], total=len(scored)
    )
