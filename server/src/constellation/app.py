"""HTTP and WebSocket API, and the built web app.

Listens on localhost only. Every request needs the per-run token, as `Authorization: Bearer <token>`
or `?token=` (browsers can't set headers on a WebSocket). Host and Origin are checked too, so a web
page on another site can't reach the server through the browser (DNS rebinding).
"""

from __future__ import annotations

import asyncio
import contextlib
import secrets
from pathlib import Path
from urllib.parse import urlparse

from fastapi import Depends, FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .collector import Collector
from .manager import Manager, ManagerError
from .protocol import (
    AnswerRequest,
    EntryContent,
    EntryPage,
    Event,
    PromptRequest,
    Queued,
    RenameRequest,
    Snapshot,
    SnapshotEvent,
    Started,
    StartRequest,
    Turn,
)

LOCAL_HOSTS = ["127.0.0.1", "localhost"]
QUEUE_MAX = 2000  # a client this far behind is dropped; it reconnects and gets a fresh snapshot


class Hub:
    """Fans events out to every connected WebSocket."""

    def __init__(self) -> None:
        self.queues: set[asyncio.Queue[str | None]] = set()

    def publish(self, events: list[Event]) -> None:
        for event in events:
            data = event.model_dump_json()
            for queue in list(self.queues):
                if queue.qsize() >= QUEUE_MAX:
                    self.queues.discard(queue)
                    queue.put_nowait(None)  # tells the sender to close
                else:
                    queue.put_nowait(data)


def create_app(
    collector: Collector,
    token: str,
    web_dist: Path | None = None,
    poll_interval: float = 0.5,
    manager: Manager | None = None,
) -> FastAPI:
    hub = Hub()
    manager = manager or collector.manager or Manager()
    collector.manager = manager  # one manager: the collector marks its sessions as managed

    async def poll_forever() -> None:
        while True:
            try:
                hub.publish(await asyncio.to_thread(collector.poll))
            except Exception as error:  # keep watching: one bad read must not stop the map
                print(f"poll failed: {error!r}")
            await asyncio.sleep(poll_interval)

    @contextlib.asynccontextmanager
    async def lifespan(_: FastAPI):
        task = asyncio.create_task(poll_forever())
        yield
        task.cancel()
        await manager.close()  # managed sessions end with the server; their transcripts stay

    app = FastAPI(title="Constellation", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=LOCAL_HOSTS)

    def authorized(request: Request) -> None:
        header = request.headers.get("authorization", "")
        given = header.removeprefix("Bearer ") if header.startswith("Bearer ") else request.query_params.get("token")
        if not given or not secrets.compare_digest(given, token):
            raise HTTPException(status_code=401, detail="missing or wrong token")
        origin = request.headers.get("origin")
        if origin and urlparse(origin).hostname not in LOCAL_HOSTS:  # a page on another site, even with the token
            raise HTTPException(status_code=403, detail="cross-site request")

    api = [Depends(authorized)]

    @app.get("/api/snapshot", dependencies=api)
    def snapshot() -> Snapshot:
        return collector.snapshot()

    @app.get("/api/sessions/{key}/turns", dependencies=api)
    def turns(key: str) -> list[Turn]:
        result = collector.turns(key)
        if result is None:
            raise HTTPException(status_code=404, detail="no such session")
        return result

    @app.get("/api/sessions/{key}/entries", dependencies=api)
    def entries(
        key: str,
        before: int | None = None,
        after: int | None = None,
        around: str | None = None,
        turn: int | None = None,
        limit: int = Query(200, ge=1, le=2000),
    ) -> EntryPage:
        page = collector.page(key, before=before, after=after, around=around, turn=turn, limit=limit)
        if page is None:
            raise HTTPException(status_code=404, detail="no such session")
        return page

    @app.get("/api/sessions/{key}/entries/{entry_id}", dependencies=api)
    def entry(key: str, entry_id: str) -> EntryContent:
        content = collector.content(key, entry_id)
        if content is None:
            raise HTTPException(status_code=404, detail="no such entry")
        return content

    # ── Managed sessions ──────────────────────────────────────────────────

    def refused(error: ManagerError) -> HTTPException:
        return HTTPException(status_code=409, detail=str(error))

    @app.post("/api/sessions", dependencies=api)
    async def start(request: StartRequest) -> Started:
        if request.mode == "bypassPermissions":
            # The design system asks for a second, confirming key; that arrives with mode switching (3.6).
            raise HTTPException(status_code=422, detail="bypass can't be chosen at start yet")
        try:
            managed = await manager.start(request.cwd, model=request.model, mode=request.mode, name=request.name)
        except ManagerError as error:
            raise refused(error) from error
        return Started(id=managed.id)

    @app.post("/api/sessions/{key}/prompt", dependencies=api)
    async def prompt(key: str, request: PromptRequest) -> Queued:
        try:
            images = [(image.media_type, image.data) for image in request.images]
            return Queued(queued=await manager.prompt(key, request.text, images))
        except ManagerError as error:
            raise refused(error) from error

    @app.post("/api/sessions/{key}/rename", dependencies=api)
    async def rename(key: str, request: RenameRequest) -> Queued:
        try:
            return Queued(queued=await manager.rename(key, request.name))
        except ManagerError as error:
            raise refused(error) from error

    @app.delete("/api/sessions/{key}/queue", dependencies=api, status_code=204)
    async def clear_queue(key: str) -> None:
        try:
            manager.clear_queue(key)
        except ManagerError as error:
            raise refused(error) from error

    @app.post("/api/sessions/{key}/interrupt", dependencies=api, status_code=204)
    async def interrupt(key: str) -> None:
        try:
            await manager.interrupt(key)
        except ManagerError as error:
            raise refused(error) from error

    @app.post("/api/sessions/{key}/stop", dependencies=api, status_code=204)
    async def stop(key: str) -> None:
        try:
            await manager.stop(key)
        except ManagerError as error:
            raise refused(error) from error

    @app.post("/api/sessions/{key}/pending/{request_id}", dependencies=api, status_code=204)
    async def answer(key: str, request_id: str, request: AnswerRequest) -> None:
        try:
            manager.answer(
                key,
                request_id,
                allow=request.allow,
                message=request.message,
                updated_input=request.updated_input,
                remember=request.remember,
            )
        except ManagerError as error:
            raise refused(error) from error

    @app.websocket("/api/live")
    async def live(ws: WebSocket) -> None:
        origin = ws.headers.get("origin")
        given = ws.query_params.get("token") or ""
        if (origin and urlparse(origin).hostname not in LOCAL_HOSTS) or not secrets.compare_digest(given, token):
            await ws.close(code=4401)
            return
        await ws.accept()
        queue: asyncio.Queue[str | None] = asyncio.Queue()
        hub.queues.add(queue)  # before the snapshot: later events may repeat it, and upserts make that harmless
        try:
            first = SnapshotEvent(snapshot=await asyncio.to_thread(collector.snapshot))
            await ws.send_text(first.model_dump_json())
            while (data := await queue.get()) is not None:
                await ws.send_text(data)
            await ws.close(code=4429)  # fell too far behind
        except WebSocketDisconnect:
            pass
        finally:
            hub.queues.discard(queue)

    if web_dist and (web_dist / "index.html").exists():
        app.mount("/", StaticFiles(directory=web_dist, html=True), name="web")
    return app
