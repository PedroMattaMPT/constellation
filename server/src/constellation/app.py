"""HTTP and WebSocket API, and the built web app.

Listens on localhost only. Every request needs the per-run token, as `Authorization: Bearer <token>`
or `?token=` (browsers can't set headers on a WebSocket). Host and Origin are checked too, so a web
page on another site can't reach the server through the browser (DNS rebinding).
"""

from __future__ import annotations

import asyncio
import contextlib
import secrets
import time
from pathlib import Path
from urllib.parse import urlparse

from claude_agent_sdk import get_session_info
from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from starlette.middleware.trustedhost import TrustedHostMiddleware

from . import history, hooks, options, paths, resources, summary, tmux
from .claude import files
from .collector import Collector
from .inbox import Inbox, InboxError
from .manager import Manager, ManagerError
from .protocol import (
    AnswerRequest,
    ContextCategory,
    ContextUsage,
    EffortRequest,
    EntryContent,
    EntryPage,
    Event,
    FileMatches,
    FolderMatches,
    ForkRequest,
    HookStatus,
    Limits,
    LimitsRequest,
    LinkMessage,
    McpServer,
    MemoryFile,
    MessageRequest,
    ModelInfo,
    ModelRequest,
    ModeRequest,
    NoticeEvent,
    PastPrompt,
    PastSession,
    PromptRequest,
    Queued,
    RenameRequest,
    ResumeRequest,
    RewindPreview,
    RewindRequest,
    SearchHit,
    SessionOptions,
    SessionPreview,
    Snapshot,
    SnapshotEvent,
    Started,
    StartRequest,
    TagRequest,
    ToggleRequest,
    Turn,
    UsageReport,
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


def _mcp(servers: list[dict]) -> list[McpServer]:
    states = {"connected", "failed", "needs-auth", "pending", "disabled"}
    return [
        McpServer(
            name=m.get("name") or "?",
            status=m.get("status") if m.get("status") in states else "failed",
            tools=len(m.get("tools") or []),
            error=m.get("error"),
            scope=m.get("scope"),
        )
        for m in servers
    ]


def create_app(
    collector: Collector,
    token: str,
    web_dist: Path | None = None,
    poll_interval: float = 0.5,
    manager: Manager | None = None,
    url: str | None = None,
    inbox: Inbox | None = None,
) -> FastAPI:
    """`url`: where this server listens, published for the hook script (roadmap 3.12)."""
    hub = Hub()
    manager = manager or collector.manager or Manager()
    collector.manager = manager  # one manager: the collector marks its sessions as managed
    collector.ignore.add(str(summary.folder()))  # summary calls are Constellation's own, not sessions
    inbox = inbox or Inbox()
    manager.notify = lambda text: hub.publish([NoticeEvent(text=text, at=int(time.time() * 1000))])

    async def poll_forever() -> None:
        while True:
            try:
                hub.publish(await asyncio.to_thread(collector.poll))
            except Exception as error:  # keep watching: one bad read must not stop the map
                print(f"poll failed: {error!r}")
            await asyncio.sleep(poll_interval)

    async def sample_forever() -> None:
        while True:
            try:
                await asyncio.to_thread(collector.sample)
            except Exception as error:  # the map goes on without resources
                print(f"sample failed: {error!r}")
            await asyncio.sleep(resources.SAMPLE_EVERY_S)

    @contextlib.asynccontextmanager
    async def lifespan(_: FastAPI):
        task = asyncio.create_task(poll_forever())
        sampling = asyncio.create_task(sample_forever())
        try:
            await inbox.start()
        except OSError as error:  # messaging terminal sessions won't work; everything else does
            print(f"no inbox socket: {error!r}")
        if url:
            hooks.publish(url, token)
        yield
        task.cancel()
        sampling.cancel()
        if url:
            hooks.unpublish(token)
        await inbox.close()
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

    @app.get("/api/sessions/{key}/usage", dependencies=api)
    def usage_report(key: str) -> UsageReport:
        result = collector.usage(key)
        if result is None:
            raise HTTPException(status_code=404, detail="no such session")
        return result

    @app.get("/api/search", dependencies=api)
    def search(query: str = "", limit: int = Query(50, ge=1, le=200)) -> list[SearchHit]:
        return collector.search(query, limit)

    @app.get("/api/limits", dependencies=api)
    def limits() -> Limits:
        return collector.limits

    @app.post("/api/limits", dependencies=api)
    def change_limits(request: LimitsRequest) -> Limits:
        try:
            collector.limits = collector.settings.change(request)
        except OSError as error:
            raise HTTPException(status_code=500, detail=f"couldn't save the limits: {error}") from error
        return collector.limits

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

    @app.get("/api/sessions/{key}/entries/{entry_id}/images/{n}", dependencies=api)
    def image(key: str, entry_id: str, n: int) -> Response:
        """An image sent with a prompt, as it was sent (the transcript keeps it)."""
        found = collector.image(key, entry_id, n)
        if found is None:
            raise HTTPException(status_code=404, detail="no such image")
        media_type, data = found
        return Response(content=data, media_type=media_type, headers={"Cache-Control": "private, max-age=3600"})

    @app.get("/api/sessions/{key}/entries/{entry_id}", dependencies=api)
    def entry(key: str, entry_id: str) -> EntryContent:
        content = collector.content(key, entry_id)
        if content is None:
            raise HTTPException(status_code=404, detail="no such entry")
        return content

    # ── Managed sessions ──────────────────────────────────────────────────

    def refused(error: ManagerError) -> HTTPException:
        return HTTPException(status_code=409, detail=str(error))

    def managed_or_409(key: str):
        try:
            return manager._get(key)
        except ManagerError as error:
            raise refused(error) from error

    @app.get("/api/models", dependencies=api)
    def models() -> list[ModelInfo]:
        """For the launcher: the list the latest session reported, or Claude Code's aliases before any has."""
        return options.models(manager.models) or options.FALLBACK_MODELS

    @app.post("/api/sessions", dependencies=api)
    async def start(request: StartRequest) -> Started:
        if request.mode == "bypassPermissions" and request.confirm != Path(request.cwd.rstrip("/")).name:
            # The design system's launcher rule: bypass needs the folder's name typed back.
            raise HTTPException(status_code=422, detail="bypass needs the folder's name typed back")
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
                mode=request.mode,
            )
        except ManagerError as error:
            raise refused(error) from error

    # ── Commands, model, mode, context, MCP (managed) ─────────────────────

    @app.get("/api/sessions/{key}/options", dependencies=api)
    def session_options(key: str) -> SessionOptions:
        managed = managed_or_409(key)
        effort = managed.effort or files.setting(managed.cwd, "effortLevel")
        model = managed.model or collector.model_of(key)  # before its first turn: the model its transcript last used
        return options.session_options(managed.info, managed.cwd, model, effort)

    @app.post("/api/sessions/{key}/model", dependencies=api, status_code=204)
    async def set_model(key: str, request: ModelRequest) -> None:
        try:
            await manager.set_model(key, request.model)
        except ManagerError as error:
            raise refused(error) from error

    @app.post("/api/sessions/{key}/effort", dependencies=api)
    async def set_effort(key: str, request: EffortRequest) -> Queued:
        try:
            return Queued(queued=await manager.set_effort(key, request.effort))
        except ManagerError as error:
            raise refused(error) from error

    @app.post("/api/sessions/{key}/mode", dependencies=api, status_code=204)
    async def set_mode(key: str, request: ModeRequest) -> None:
        if request.mode == "bypassPermissions":
            # Design system principle 5: bypass takes a second key that names the session.
            name = (await asyncio.to_thread(collector.registry, key) or {}).get("name")
            if not name or request.confirm != name:
                raise HTTPException(status_code=422, detail="bypass needs the session's name as confirm")
        try:
            await manager.set_mode(key, request.mode)
        except ManagerError as error:
            raise refused(error) from error

    @app.get("/api/sessions/{key}/context", dependencies=api)
    async def context(key: str) -> ContextUsage:
        try:
            usage = await manager.context(key)
        except ManagerError as error:
            raise refused(error) from error
        maximum = usage.get("rawMaxTokens") or usage.get("maxTokens") or 1
        threshold = usage.get("autoCompactThreshold")
        return ContextUsage(
            model=usage.get("model") or "",
            total_tokens=usage.get("totalTokens") or 0,
            max_tokens=maximum,
            percent=usage.get("percentage") or 0,
            auto_compact=bool(usage.get("isAutoCompactEnabled")),
            compact_at=threshold / maximum if threshold and usage.get("isAutoCompactEnabled") else None,
            categories=[
                ContextCategory(
                    id=c.get("id") or c.get("name", ""),
                    name=c.get("name", ""),
                    tokens=c.get("tokens") or 0,
                    kind=c.get("kind") or ("deferred" if c.get("isDeferred") else "used"),
                )
                for c in usage.get("categories") or []
            ],
            memory_files=[
                MemoryFile(path=str(m.get("path") or ""), tokens=m.get("tokens") or 0)
                for m in usage.get("memoryFiles") or []
                if isinstance(m, dict)
            ],
        )

    @app.post("/api/sessions/{key}/tasks/{task_id}/stop", dependencies=api, status_code=204)
    async def stop_task(key: str, task_id: str) -> None:
        try:
            await manager.stop_task(key, task_id)
        except ManagerError as error:
            raise refused(error) from error

    @app.get("/api/sessions/{key}/mcp", dependencies=api)
    async def mcp(key: str) -> list[McpServer]:
        try:
            return _mcp(await manager.mcp(key))
        except ManagerError as error:
            raise refused(error) from error

    @app.post("/api/sessions/{key}/mcp/{server}/reconnect", dependencies=api)
    async def mcp_reconnect(key: str, server: str) -> list[McpServer]:
        try:
            return _mcp(await manager.mcp_reconnect(key, server))
        except ManagerError as error:
            raise refused(error) from error

    @app.post("/api/sessions/{key}/mcp/{server}/toggle", dependencies=api)
    async def mcp_toggle(key: str, server: str, request: ToggleRequest) -> list[McpServer]:
        try:
            return _mcp(await manager.mcp_toggle(key, server, request.enabled))
        except ManagerError as error:
            raise refused(error) from error

    # ── History: fork, rewind, resume, tag ────────────────────────────────

    @app.post("/api/sessions/{key}/fork", dependencies=api)
    async def fork(key: str, request: ForkRequest) -> Started:
        managed = managed_or_409(key)
        registry = await asyncio.to_thread(collector.registry, key) or {}
        name = request.name or f"{registry.get('name') or managed.name or 'session'}-fork"
        try:
            return Started(id=(await manager.fork(key, name)).id)
        except ManagerError as error:
            raise refused(error) from error

    @app.get("/api/sessions/{key}/rewind/{entry_id}", dependencies=api)
    def rewind_preview(key: str, entry_id: str) -> RewindPreview:
        preview = collector.rewind_preview(key, entry_id)
        if preview is None:
            raise HTTPException(status_code=404, detail="no such prompt")
        return preview

    @app.post("/api/sessions/{key}/rewind", dependencies=api)
    async def rewind(key: str, request: RewindRequest) -> Started:
        found = collector.prompt_parent(key, request.entry)
        if found is None:
            raise HTTPException(status_code=404, detail="no such prompt")
        parent, current = found
        if request.conversation and not current:
            raise HTTPException(status_code=409, detail="that prompt is from before a /clear: only its files rewind")
        try:
            managed = await manager.rewind(
                key, request.entry, parent, files_too=request.files, conversation=request.conversation
            )
        except ManagerError as error:
            raise refused(error) from error
        return Started(id=managed.id)

    @app.get("/api/history", dependencies=api)
    async def past(query: str = "", limit: int = Query(200, ge=1, le=1000)) -> list[PastSession]:
        return await asyncio.to_thread(lambda: history.past(collector.running(), query, limit))

    @app.get("/api/history/{session_id}", dependencies=api)
    async def preview(session_id: str, cwd: str | None = None) -> SessionPreview:
        try:
            return await asyncio.to_thread(history.preview, session_id, cwd)
        except (OSError, ValueError) as error:
            raise HTTPException(status_code=404, detail=f"no such session: {error}") from error

    @app.post("/api/history/{session_id}/resume", dependencies=api)
    async def resume(session_id: str, request: ResumeRequest) -> Started:
        running = (await asyncio.to_thread(collector.running)).get(session_id)
        if running and not request.fork:
            # One process per session: a running one is adopted, or forked.
            raise HTTPException(status_code=409, detail="it's running: adopt it, or fork it")
        info = await asyncio.to_thread(get_session_info, session_id)
        if info is None or not info.cwd:
            raise HTTPException(status_code=404, detail="no such session")
        try:
            managed = await manager.start(info.cwd, name=request.name, resume=session_id, fork=request.fork)
        except ManagerError as error:
            raise refused(error) from error
        if request.fork:
            manager.record_fork(running, info.custom_title or info.summary or session_id[:8], managed.id)
        return Started(id=managed.id)

    @app.post("/api/history/{session_id}/tag", dependencies=api, status_code=204)
    async def tag(session_id: str, request: TagRequest) -> None:
        if session_id in (await asyncio.to_thread(collector.running)):
            raise HTTPException(status_code=409, detail="it's running: tag it once it has stopped")
        try:
            await asyncio.to_thread(history.tag, session_id, request.tag)
        except (OSError, ValueError) as error:
            raise HTTPException(status_code=404, detail=str(error)) from error

    # ── Sessions you didn't start ─────────────────────────────────────────

    @app.post("/api/sessions/{key}/message", dependencies=api, status_code=204)
    async def message(key: str, request: MessageRequest) -> None:
        registry = await asyncio.to_thread(collector.registry, key)
        if registry is None:
            raise HTTPException(status_code=404, detail="no such session")
        if key in manager.sessions:
            raise HTTPException(status_code=409, detail="it's managed: send it a prompt")
        if not registry.get("messagingSocketPath") or registry.get("peerProtocol") != 1:
            raise HTTPException(status_code=409, detail="it has no inbox Constellation knows how to use")
        try:
            await inbox.send(registry["messagingSocketPath"], request.text)
        except InboxError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    @app.post("/api/sessions/{key}/adopt", dependencies=api, status_code=204)
    async def adopt(key: str) -> None:  # async: the wait for the terminal copy runs on the event loop
        registry = await asyncio.to_thread(collector.registry, key)
        if registry is None:
            raise HTTPException(status_code=404, detail="no such session")
        if key in manager.sessions:
            raise HTTPException(status_code=409, detail="it's already managed")
        r = registry
        manager.adopt(key, r["sessionId"], r["cwd"], r.get("name"), r["pid"], r.get("procStart"))

    @app.delete("/api/sessions/{key}/adopt", dependencies=api, status_code=204)
    async def cancel_adopt(key: str) -> None:
        manager.cancel_adoption(key)

    @app.post("/api/sessions/{key}/terminal", dependencies=api, status_code=204)
    def terminal(key: str) -> None:
        registry = collector.registry(key)
        if registry is None:
            raise HTTPException(status_code=404, detail="no such session")
        if not registry.get("tmux"):
            raise HTTPException(status_code=409, detail="it isn't running in tmux")
        try:
            tmux.go_to(registry["tmux"])
        except tmux.TmuxError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    @app.post("/api/sessions/{key}/summary", dependencies=api, status_code=204)
    async def summarize(key: str) -> None:
        free = collector.summary_for_free(key)
        if free is not None:
            collector.summaries[key] = free  # nothing happened since: no model call
            return
        found = collector.activity(key)
        if found is None:
            raise HTTPException(status_code=404, detail="no such session")
        task, lines = found
        if not lines:
            raise HTTPException(status_code=409, detail="nothing to summarize yet")
        try:
            line = await summary.summarize(task, lines, manager.cli_path)
        except (OSError, RuntimeError) as error:
            raise HTTPException(status_code=409, detail=f"no summary: {error}") from error
        collector.summaries[key] = (line, int(time.time() * 1000), "model")  # one dict write: no lock needed

    @app.get("/api/folders", dependencies=api)
    def folders(path: str = "") -> FolderMatches:
        """Folder completion for the launcher."""
        return paths.folders(path)

    @app.get("/api/sessions/{key}/files", dependencies=api)
    def files_for(key: str, query: str = "") -> FileMatches:
        """`@` mentions: the session's project files that match."""
        registry = collector.registry(key)
        if registry is None:
            raise HTTPException(status_code=404, detail="no such session")
        return paths.files(registry["cwd"], query)

    @app.get("/api/prompts", dependencies=api)
    def past_prompts(cwd: str, query: str = "") -> list[PastPrompt]:
        """Your prompts in that folder, newest first, once each (C-r): Claude Code's history, plus the prompts of the
        sessions running there, which holds the ones sent through Constellation."""
        newest: dict[str, int] = {p.text: p.at for p in history.prompts(cwd, query, collector.claude_dir)}
        needle = query.lower().strip()
        for text, at in collector.prompts(cwd):
            if text.strip() and needle in text.lower() and at > newest.get(text, -1):
                newest[text] = at
        ordered = sorted(newest.items(), key=lambda pair: pair[1], reverse=True)
        return [PastPrompt(text=text, at=at) for text, at in ordered[: history.PROMPTS_MAX]]

    @app.get("/api/links", dependencies=api)
    def links(source: str, target: str) -> list[LinkMessage]:
        return collector.link(source, target)

    # ── Hooks for terminal sessions (3.12) ────────────────────────────────

    @app.get("/api/hooks", dependencies=api)
    def hook_status() -> HookStatus:
        return hooks.status(collector.claude_dir)

    @app.post("/api/hooks", dependencies=api)
    def install_hooks() -> HookStatus:
        try:
            return hooks.install(collector.claude_dir)
        except (OSError, ValueError) as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    @app.delete("/api/hooks", dependencies=api)
    def remove_hooks() -> HookStatus:
        try:
            return hooks.uninstall(collector.claude_dir)
        except OSError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    def locked_add(payload: dict) -> None:
        with collector.lock:  # in a thread: a long poll holds the lock, and the event loop mustn't wait on it
            collector.hooks.add(payload)

    @app.post("/api/hooks/report", dependencies=api, status_code=204)
    async def hook_report(request: Request) -> None:
        try:
            payload = await request.json()
        except ValueError:
            return
        managed = {m.session_id for m in manager.sessions.values()}
        if isinstance(payload, dict) and payload.get("session_id") not in managed:  # those come through the SDK
            await asyncio.to_thread(locked_add, payload)

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
