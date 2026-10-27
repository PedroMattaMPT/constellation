from __future__ import annotations

import os

import pytest

from constellation.protocol import Limits, LimitsRequest, Resources
from constellation.resources import GB, Minute, Sampler, Settings, Tree, alerts


def procs(*rows):
    """(pid, created, cpu seconds, ppid, rss) -> what Sampler._measure returns."""
    return {(pid, created): (cpu, ppid, rss, pid) for pid, created, cpu, ppid, rss in rows}


def test_cpu_counts_children_that_came_and_went_between_samples():
    tree = Tree()
    Sampler._update(tree, procs((1, 0.0, 100.0, 0, 10), (2, 0.0, 50.0, 1, 5)), now=100.0, gpu_used=None)
    assert tree.now.cpu == 0 and tree.now.memory == 15  # the first sample has nothing to compare with
    # 10 s later: the shell (2) ran a 3-second compile that already exited, then exited itself after 1 more second
    # of its own; claude (1) waited for it, so its children's time grew by the shell's whole life.
    Sampler._update(tree, procs((1, 0.0, 100.0 + 2.0 + 54.0, 0, 10)), now=110.0, gpu_used=None)
    assert tree.now.cpu == pytest.approx((2.0 + 4.0) / 10 * 100)  # its own 2 s, plus the shell's 4 new seconds
    # A process started since the last sample: all of its time is new.
    Sampler._update(tree, procs((1, 0.0, 156.0, 0, 10), (3, 115.0, 5.0, 1, 1)), now=120.0, gpu_used={3: 2 * GB})
    assert tree.now.cpu == pytest.approx(50.0) and tree.now.gpu == 2 * GB and tree.now.processes == 2
    assert len(tree.now.cpu_history) == 2  # minute buckets: 100-119 s is minute 1, 120 s is minute 2


def test_a_live_process_tree_is_sampled():
    sampler = Sampler(gpu=lambda: None)
    sampler.sample({"me": os.getpid(), "gone": 2**22 + 7})
    sampler.sample({"me": os.getpid(), "gone": 2**22 + 7})
    now, minutes = sampler.get("me")
    assert now is not None and now.memory > 0 and now.processes >= 1 and now.gpu is None and minutes
    assert sampler.get("gone") == (None, [])  # no such process


def test_limits_default_from_the_machine_and_are_saved_when_changed(tmp_path):
    settings = Settings(tmp_path / "settings.json", memory_total=32 * GB)
    settings.gpu_total = 16 * GB
    assert settings.limits() == Limits(memory_gb=8.0, gpu_gb=16.0, cpu_percent=200)
    assert settings.change(LimitsRequest(gpu_gb=20)).gpu_gb == 20
    assert Settings(tmp_path / "settings.json", memory_total=32 * GB).limits().gpu_gb == 20  # read back
    assert settings.change(LimitsRequest(reset=True)).gpu_gb == 16.0


def resources(cpu=0.0, memory=0, gpu=None) -> Resources:
    return Resources(cpu=cpu, memory=memory, gpu=gpu, processes=1, cpu_history=[], memory_history=[], gpu_history=[])


def test_alerts_follow_the_design_systems_thresholds():
    limits = Limits(memory_gb=8, gpu_gb=20, cpu_percent=200)
    assert alerts(79.9, resources(), [], limits) == []
    (ctx,) = alerts(83, resources(), [], limits)
    assert (ctx.kind, ctx.level, ctx.text) == ("ctx", "warning", "context 83%")
    found = alerts(97, resources(memory=int(6.5 * GB), gpu=int(21.4 * GB)), [], limits)
    assert [(a.kind, a.level, a.text) for a in found] == [
        ("ctx", "critical", "context 97%"),
        ("gpu", "critical", "GPU 21.4/20 GB"),
        ("mem", "warning", "memory 6.5/8 GB"),
    ]
    busy = [Minute(at=i, cpu_sum=250.0, samples=1) for i in range(6)]
    assert [a.text for a in alerts(None, resources(cpu=240), busy, limits)] == ["CPU 240% for 6m"]
    assert alerts(None, resources(cpu=240), busy[:4], limits) == []  # 4 minutes isn't runaway yet
    calm = [*busy, Minute(at=7, cpu_sum=50.0, samples=1)]
    assert alerts(None, resources(cpu=50), calm, limits) == []
