"""Go to terminal: switch your tmux to the pane a session runs in (the registry's `tmux` field)."""

from __future__ import annotations

import re
import shutil
import subprocess

PANE = re.compile(r"(%\d+)$")  # "work:@3.%47" → "%47"


class TmuxError(Exception):
    pass


def _run(*args: str) -> str:
    try:
        done = subprocess.run(["tmux", *args], capture_output=True, text=True, timeout=3)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise TmuxError(str(error)) from error
    if done.returncode != 0:
        raise TmuxError(done.stderr.strip() or f"tmux {args[0]} failed")
    return done.stdout


def go_to(target: str) -> None:
    """Shows the pane in the tmux client you used last, whether or not this server runs inside tmux."""
    if not shutil.which("tmux"):
        raise TmuxError("tmux isn't installed")
    match = PANE.search(target)
    if not match:
        raise TmuxError(f"not a tmux pane: {target}")
    pane = match.group(1)
    clients = sorted(
        (line.split(" ", 1) for line in _run("list-clients", "-F", "#{client_activity} #{client_name}").splitlines()),
        key=lambda c: int(c[0]) if c[0].isdigit() else 0,
        reverse=True,
    )
    if not clients:
        raise TmuxError("no tmux client is attached")
    _run("switch-client", "-c", clients[0][1], "-t", pane)
    _run("select-window", "-t", pane)
    _run("select-pane", "-t", pane)
