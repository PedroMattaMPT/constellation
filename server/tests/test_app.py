from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from constellation.app import create_app
from constellation.collector import Collector

AUTH = {"Authorization": "Bearer secret"}
LOCAL = {"host": "127.0.0.1:7337"}  # the test client sends "testserver" on WebSockets


@pytest.fixture
def app(claude, me):
    claude.register(me, "s1", "lab-a")
    claude.transcript("/lab/a", "s1", "lab-a.1-main.jsonl")
    collector = Collector(claude.root, waiting_for=dict)
    collector.poll()
    return create_app(collector, "secret", poll_interval=0.05)


def test_every_request_needs_the_token(app):
    with TestClient(app, base_url="http://127.0.0.1") as client:
        assert client.get("/api/snapshot").status_code == 401
        assert client.get("/api/snapshot", headers={"Authorization": "Bearer wrong"}).status_code == 401
        assert client.get("/api/snapshot", headers=AUTH).status_code == 200
        assert client.get("/api/snapshot?token=secret").status_code == 200


def test_other_hosts_are_refused(app):
    with TestClient(app, base_url="http://evil.example") as client:
        assert client.get("/api/snapshot", headers=AUTH).status_code == 400


def test_snapshot_pages_turns_and_content(app):
    with TestClient(app, base_url="http://127.0.0.1") as client:
        session = client.get("/api/snapshot", headers=AUTH).json()["sessions"][0]
        assert "sessionIds" in session and "waitingFor" in session  # camelCase on the wire
        key = session["id"]

        page = client.get(f"/api/sessions/{key}/entries?limit=5", headers=AUTH).json()
        assert len(page["entries"]) == 5 and page["hasBefore"] and not page["hasAfter"]
        older = client.get(f"/api/sessions/{key}/entries?before={page['entries'][0]['seq']}&limit=5", headers=AUTH)
        assert [e["seq"] for e in older.json()["entries"]] == list(
            range(page["entries"][0]["seq"] - 5, page["entries"][0]["seq"])
        )

        turns = client.get(f"/api/sessions/{key}/turns", headers=AUTH).json()
        assert turns[0]["entry"]["text"] == "/rename lab-a" and all(t["entry"]["starter"] for t in turns)

        question = next(
            e
            for e in client.get(f"/api/sessions/{key}/entries?limit=2000", headers=AUTH).json()["entries"]
            if e["kind"] == "question"
        )
        around = client.get(f"/api/sessions/{key}/entries?around={question['id']}&limit=10", headers=AUTH).json()
        assert question["id"] in [e["id"] for e in around["entries"]]
        content = client.get(f"/api/sessions/{key}/entries/{question['id']}", headers=AUTH).json()
        assert "Blue" in content["result"]

        assert client.get("/api/sessions/nope/turns", headers=AUTH).status_code == 404


def test_live_sends_a_snapshot_first(app):
    with TestClient(app, base_url="http://127.0.0.1") as client:
        with client.websocket_connect("/api/live?token=secret", headers=LOCAL) as ws:
            assert ws.receive_json()["type"] == "snapshot"
        with pytest.raises(WebSocketDisconnect), client.websocket_connect("/api/live?token=wrong", headers=LOCAL) as ws:
            ws.receive_json()
