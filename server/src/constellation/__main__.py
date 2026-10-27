"""constellation serve | schema | snapshot"""

from __future__ import annotations

import argparse
import json
import os
import secrets
import sys
import time
from pathlib import Path

WEB_DIST = Path(__file__).resolve().parents[3] / "web" / "dist"


def serve(args: argparse.Namespace) -> None:
    import uvicorn

    from .app import create_app
    from .collector import Collector
    from .manager import Manager, leave_parent_session

    leave_parent_session()  # started from inside a Claude Code session: its sessions mustn't look like its children
    token = args.token or os.environ.get("CONSTELLATION_TOKEN") or secrets.token_urlsafe(24)
    collector = Collector(manager=Manager())
    started = time.time()
    collector.poll()  # read the backlog before accepting clients
    print(f"watching {len(collector.nodes)} sessions (read in {time.time() - started:.1f}s)")
    base = args.ui or f"http://{args.host}:{args.port}"
    print(f"open {base}/?token={token}", flush=True)
    url = f"http://{args.host}:{args.port}"
    app = create_app(collector, token, None if args.ui else WEB_DIST, poll_interval=args.poll, url=url)
    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")


def schema(_: argparse.Namespace) -> None:
    from .protocol import Protocol

    def drop_property_titles(node: object) -> None:
        """Pydantic titles every property; generators then make a named type per field."""
        if isinstance(node, dict):
            for prop in node.get("properties", {}).values():
                prop.pop("title", None)
            for value in node.values():
                drop_property_titles(value)
        elif isinstance(node, list):
            for value in node:
                drop_property_titles(value)

    document = Protocol.model_json_schema(by_alias=True, mode="serialization")  # defaults are always sent
    drop_property_titles(document)
    json.dump(document, sys.stdout, indent=2)
    print()


def snapshot(_: argparse.Namespace) -> None:
    from .collector import Collector

    collector = Collector()
    collector.poll()
    print(collector.snapshot().model_dump_json(indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(prog="constellation", description="A control room for your Claude Code sessions.")
    commands = parser.add_subparsers(dest="command", required=True)

    run = commands.add_parser("serve", help="run the server (and the built web app)")
    run.add_argument("--host", default="127.0.0.1", choices=["127.0.0.1", "localhost"], help="localhost only")
    run.add_argument("--port", type=int, default=7337)
    run.add_argument("--token", help="fixed token instead of a random one; CONSTELLATION_TOKEN works too")
    run.add_argument("--ui", help="where the web app is served from, when not by this server (Vite in development)")
    run.add_argument("--poll", type=float, default=0.5, help="seconds between polls")
    run.set_defaults(func=serve)

    commands.add_parser("schema", help="print the protocol as JSON Schema").set_defaults(func=schema)
    commands.add_parser("snapshot", help="print one snapshot and exit").set_defaults(func=snapshot)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
