"""What each session costs the machine (roadmap 4.1, 4.2), and the alerts it raises (4.5).

Every few seconds the sampler walks each session's process tree (claude, its shells, MCP servers, dev servers) and
keeps 30 one-minute buckets of CPU, memory and GPU memory, as the design system's `Sparkline` draws them.

CPU counts processes that came and went between two samples too: a process's time includes the children it waited
for, so a build's short-lived compilers land on the shell that ran them.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import threading
import time
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path

import psutil

from .protocol import Alert, Limits, LimitsRequest, Resources

SAMPLE_EVERY_S = 5.0
GPU_EVERY_S = 15.0
MINUTES = 30
RUNAWAY_MINUTES = 5  # design system: runaway CPU is 5 minutes above the warning line
WARN_AT = 0.8  # of a limit
CTX_WARN, CTX_CRIT = 80, 95  # percent (design system: ContextBar)
GB = 1024**3
GONE = (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess)


@dataclass(slots=True)
class Minute:
    at: int  # minutes since the epoch
    cpu_sum: float = 0.0
    samples: int = 0
    memory: int = 0
    gpu: int | None = None


@dataclass
class Tree:
    """One session's process tree between samples."""

    seen: dict[tuple[int, float], tuple[float, int]] = field(default_factory=dict)  # (pid, created) -> (time, ppid)
    sampled_at: float | None = None
    minutes: deque[Minute] = field(default_factory=lambda: deque(maxlen=MINUTES))
    now: Resources | None = None


def _total(times) -> float:
    return times.user + times.system + times.children_user + times.children_system


def nvidia_smi() -> tuple[dict[int, int], int | None] | None:
    """GPU memory per process (bytes) and the GPU's total, or None without nvidia-smi (20 ms, roadmap 1.15)."""
    if not shutil.which("nvidia-smi"):
        return None
    try:
        apps = subprocess.run(
            ["nvidia-smi", "--query-compute-apps=pid,used_memory", "--format=csv,noheader,nounits"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        total = subprocess.run(
            ["nvidia-smi", "--query-gpu=memory.total", "--format=csv,noheader,nounits"],
            capture_output=True,
            text=True,
            timeout=5,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    used: dict[int, int] = {}
    for line in apps.stdout.splitlines():
        pid, _, mib = line.partition(",")
        if pid.strip().isdigit() and mib.strip().isdigit():
            used[int(pid)] = used.get(int(pid), 0) + int(mib) * 1024**2
    sizes = [int(x) for x in total.stdout.split() if x.strip().isdigit()]
    return used, (max(sizes) * 1024**2 if sizes else None)


class Sampler:
    def __init__(self, gpu=nvidia_smi, clock=time.time):
        self.trees: dict[str, Tree] = {}
        self.lock = threading.Lock()
        self._gpu = gpu
        self._clock = clock
        self._gpu_used: dict[int, int] | None = None
        self.gpu_total: int | None = None
        self._gpu_checked = 0.0

    def get(self, key: str) -> tuple[Resources | None, list[Minute]]:
        with self.lock:
            tree = self.trees.get(key)
            return (tree.now, list(tree.minutes)) if tree else (None, [])

    def sample(self, roots: dict[str, int]) -> None:
        """One sample of every session's tree: `roots` maps node ids to their claude process."""
        now = self._clock()
        if now - self._gpu_checked >= GPU_EVERY_S:
            self._gpu_checked = now
            found = self._gpu()
            self._gpu_used, self.gpu_total = found if found else (None, None)
        gpu_used = self._gpu_used
        measured = {key: self._measure(pid) for key, pid in roots.items()}
        with self.lock:
            for key in [k for k in self.trees if k not in roots]:
                del self.trees[key]
            for key, procs in measured.items():
                tree = self.trees.setdefault(key, Tree())
                if procs is None:
                    tree.now = None
                    continue
                self._update(tree, procs, now, gpu_used)

    @staticmethod
    def _measure(pid: int) -> dict[tuple[int, float], tuple[float, int, int, int]] | None:
        """Each process in the tree: (pid, created) -> (cpu seconds with waited-for children, ppid, rss, pid)."""
        try:
            root = psutil.Process(pid)
            procs = [root, *root.children(recursive=True)]
        except GONE:
            return None
        out = {}
        for p in procs:
            try:
                with p.oneshot():
                    out[(p.pid, p.create_time())] = (_total(p.cpu_times()), p.ppid(), p.memory_info().rss, p.pid)
            except GONE:
                continue
        return out or None

    @staticmethod
    def _update(tree: Tree, procs: dict, now: float, gpu_used: dict[int, int] | None) -> None:
        cpu = 0.0
        if tree.sampled_at is not None and now > tree.sampled_at:
            spent = 0.0
            for key, (total, _, _, _) in procs.items():
                before = tree.seen.get(key)
                if before is not None:
                    spent += total - before[0]
                elif key[1] >= tree.sampled_at - 1:  # started since the last sample: all its time is new
                    spent += total
            alive = {pid for pid, _ in procs}
            for key, (total, ppid) in tree.seen.items():
                # Gone: its parent now holds all of its time, part of which was counted before.
                if key not in procs and ppid in alive:
                    spent -= total
            cpu = max(0.0, spent) / (now - tree.sampled_at) * 100
        tree.seen = {key: (total, ppid) for key, (total, ppid, _, _) in procs.items()}
        tree.sampled_at = now
        memory = sum(rss for _, _, rss, _ in procs.values())
        gpu = None if gpu_used is None else sum(gpu_used.get(pid, 0) for _, _, _, pid in procs.values())
        minute = int(now // 60)
        if not tree.minutes or tree.minutes[-1].at != minute:
            tree.minutes.append(Minute(minute))
        m = tree.minutes[-1]
        m.cpu_sum += cpu
        m.samples += 1
        m.memory = max(m.memory, memory)
        if gpu is not None:
            m.gpu = max(m.gpu or 0, gpu)
        tree.now = Resources(
            cpu=round(cpu, 1),
            memory=memory,
            gpu=gpu,
            processes=len(procs),
            cpu_history=[round(x.cpu_sum / x.samples, 1) for x in tree.minutes if x.samples],
            memory_history=[x.memory for x in tree.minutes],
            gpu_history=[x.gpu or 0 for x in tree.minutes] if gpu is not None else [],
        )


# ── Limits ───────────────────────────────────────────────────────────────


def settings_path() -> Path:
    base = os.environ.get("XDG_CONFIG_HOME") or str(Path.home() / ".config")
    return Path(base) / "constellation" / "settings.json"


class Settings:
    """Your limits, in ~/.config/constellation/settings.json. Missing ones use defaults from this machine."""

    def __init__(self, path: Path | None = None, memory_total: int | None = None):
        self.path = path or settings_path()
        self.memory_total = memory_total if memory_total is not None else psutil.virtual_memory().total
        self.gpu_total: int | None = None  # learned from the sampler

    def _saved(self) -> dict:
        try:
            data = json.loads(self.path.read_text())
        except (OSError, ValueError):
            return {}
        return data if isinstance(data, dict) else {}

    def limits(self) -> Limits:
        saved = self._saved().get("limits") or {}
        number = lambda v: float(v) if isinstance(v, int | float) and v > 0 else None  # noqa: E731
        default_gpu = round(self.gpu_total / GB, 1) if self.gpu_total else None
        return Limits(
            memory_gb=number(saved.get("memoryGb")) or round(self.memory_total / 4 / GB, 1),
            gpu_gb=number(saved.get("gpuGb")) or default_gpu,
            cpu_percent=number(saved.get("cpuPercent")) or 200,
        )

    def change(self, request: LimitsRequest) -> Limits:
        data = self._saved()
        saved = {} if request.reset else dict(data.get("limits") or {})
        for field_name, key in (("memory_gb", "memoryGb"), ("gpu_gb", "gpuGb"), ("cpu_percent", "cpuPercent")):
            value = getattr(request, field_name)
            if value is not None:
                saved[key] = value
        data["limits"] = saved
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, indent=2) + "\n")
        tmp.replace(self.path)
        return self.limits()


# ── Alerts ───────────────────────────────────────────────────────────────


def _gb(n: float) -> str:
    return f"{n:.1f}".rstrip("0").rstrip(".")


def alerts(context_percent: float | None, now: Resources | None, minutes: list[Minute], limits: Limits) -> list[Alert]:
    """The thresholds crossed, most severe first (design system: ContextBar, Sparkline, AlertFlag)."""
    found: list[Alert] = []
    if context_percent is not None and context_percent >= CTX_WARN:
        level = "critical" if context_percent >= CTX_CRIT else "warning"
        found.append(Alert(kind="ctx", level=level, text=f"context {round(context_percent)}%"))
    if now is not None:
        busy = 0
        for m in reversed([m for m in minutes if m.samples]):
            if m.cpu_sum / m.samples < limits.cpu_percent:
                break
            busy += 1
        if busy >= RUNAWAY_MINUTES:
            found.append(Alert(kind="cpu", level="warning", text=f"CPU {round(now.cpu)}% for {busy}m"))
        for kind, used, limit, word in (
            ("mem", now.memory, limits.memory_gb, "memory"),
            ("gpu", now.gpu, limits.gpu_gb, "GPU"),
        ):
            if used is None or not limit:
                continue
            if used > limit * GB:
                level = "critical"
            elif used >= WARN_AT * limit * GB:
                level = "warning"
            else:
                continue
            found.append(Alert(kind=kind, level=level, text=f"{word} {_gb(used / GB)}/{_gb(limit)} GB"))
    found.sort(key=lambda a: a.level != "critical")
    return found
