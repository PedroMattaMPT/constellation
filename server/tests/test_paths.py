from __future__ import annotations

import json
import subprocess

from constellation import history, paths


def test_folders_complete_what_was_typed(tmp_path, monkeypatch):
    (tmp_path / "code" / "alpha").mkdir(parents=True)
    (tmp_path / "code" / "Beta").mkdir()
    (tmp_path / "code" / ".hidden").mkdir()
    (tmp_path / "code" / "afile").write_text("x")
    monkeypatch.setenv("HOME", str(tmp_path))

    found = paths.folders("~/code/")
    assert found.matches == ["~/code/alpha/", "~/code/Beta/"] and found.folder  # no files, no hidden folders
    assert paths.folders("~/code/b").matches == ["~/code/Beta/"]  # case doesn't matter
    assert paths.folders("~/code/.").matches == ["~/code/.hidden/"]  # unless you type the dot
    missing = paths.folders(str(tmp_path / "nope"))
    assert not missing.folder and missing.matches == []


def test_files_for_mentions_follow_git_and_rank_names_first(tmp_path):
    for name in ("src/app/main.ts", "src/app/readme.md", "docs/main-notes.md", "ignored/x.ts", "main.py"):
        (tmp_path / name).parent.mkdir(parents=True, exist_ok=True)
        (tmp_path / name).write_text("x")
    (tmp_path / ".gitignore").write_text("ignored/\n")
    subprocess.run(["git", "init", "-q", str(tmp_path)], check=True)
    paths._listed.clear()

    found = [m.path for m in paths.files(str(tmp_path), "main").matches]
    assert found[0] == "main.py" and "src/app/main.ts" in found and "docs/main-notes.md" in found
    assert not any(p.startswith("ignored/") for p in found)  # git's ignore rules apply
    top = paths.files(str(tmp_path), "").matches
    assert [m.path for m in top if m.folder] == ["docs/", "src/"] and all(
        "/" not in m.path for m in top if not m.folder
    )
    in_order = [m.path for m in paths.files(str(tmp_path), "sam").matches]  # the letters in order, shortest first
    assert in_order[0] == "src/app/main.ts" and "main.py" not in in_order


def test_prompt_history_is_per_folder_newest_first_once_each(tmp_path):
    lines = [
        {"display": "first", "timestamp": 1, "project": "/lab/a", "sessionId": "s1"},
        {"display": "elsewhere", "timestamp": 2, "project": "/lab/b", "sessionId": "s2"},
        {"display": "second", "timestamp": 3, "project": "/lab/a", "sessionId": "s1"},
        {"display": "first", "timestamp": 4, "project": "/lab/a", "sessionId": "s3"},
    ]
    (tmp_path / "history.jsonl").write_text("\n".join(json.dumps(x) for x in lines) + "\nnot json\n")
    assert [(p.text, p.at) for p in history.prompts("/lab/a", claude_dir=tmp_path)] == [("first", 4), ("second", 3)]
    assert [p.text for p in history.prompts("/lab/a", "SEC", claude_dir=tmp_path)] == ["second"]


def test_c_r_adds_the_prompts_of_sessions_running_in_the_folder(claude, me, tmp_path):
    from fastapi.testclient import TestClient

    from constellation.app import create_app
    from constellation.collector import Collector
    from constellation.inbox import Inbox

    claude.register(me, "s1", "lab-a", cwd="/lab/a")
    claude.transcript("/lab/a", "s1", "lab-a.1-main.jsonl")
    lines = [{"display": "from the terminal", "timestamp": 1, "project": "/lab/a", "sessionId": "s0"}]
    (claude.root / "history.jsonl").write_text("\n".join(json.dumps(x) for x in lines) + "\n")
    collector = Collector(claude.root, waiting_for=dict)
    collector.poll()
    app = create_app(collector, "secret", poll_interval=0.05, inbox=Inbox(tmp_path / "socks"))
    with TestClient(app, base_url="http://127.0.0.1") as client:
        found = client.get("/api/prompts?cwd=/lab/a", headers={"Authorization": "Bearer secret"}).json()
    texts = [p["text"] for p in found]
    assert texts[-1] == "from the terminal" and any(t.startswith("Run this exact shell command") for t in texts)
    assert not any(t.startswith("Write a detailed") and texts.count(t) > 1 for t in texts)  # once each
