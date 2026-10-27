from __future__ import annotations

from constellation import options

INFO = {
    "commands": [
        {"name": "compact", "description": "Free up context", "argumentHint": "<instructions>", "builtin": True},
        {"name": "color", "description": "Set the prompt bar color", "argumentHint": "", "builtin": True},
        {"name": "lab-echo", "description": "Echo a word. Then stop. (project)", "argumentHint": ""},
        {"name": "commit", "description": "Write a commit (user)", "argumentHint": ""},
        {"name": "plug:thing", "description": "From a plugin", "argumentHint": ""},
        {"name": "__internal", "description": "hidden", "argumentHint": ""},
    ],
    "models": [
        {
            "value": "opus",
            "resolvedModel": "claude-opus-5-5",
            "displayName": "Opus 5.5",
            "description": "Best",
            "supportedEffortLevels": ["low", "high"],
        },
    ],
}


def test_commands_carry_their_source_and_terminal_only_ones_stay_listed(tmp_path):
    (tmp_path / "commands").mkdir()
    (tmp_path / "commands" / "commit.md").write_text("x")
    found = {c.name: c for c in options.commands(INFO, "/nowhere", claude_dir=tmp_path)}
    assert found["compact"].source == "built-in" and found["compact"].argument_hint == "<instructions>"
    assert found["lab-echo"].source == "skill" and found["lab-echo"].description == "Echo a word"
    assert found["commit"].source == "command" and found["plug:thing"].source == "plugin"
    assert found["color"].unavailable == "terminal-only" and found["theme"].unavailable == "terminal-only"
    assert "__internal" not in found and {"resume", "rewind", "fork"} <= set(found)


def test_models_come_from_the_server_list():
    (model,) = options.models(INFO["models"])
    assert (model.value, model.name, model.model, model.efforts) == (
        "opus",
        "Opus 5.5",
        "claude-opus-5-5",
        ["low", "high"],
    )
