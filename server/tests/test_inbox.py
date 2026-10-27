from __future__ import annotations

import asyncio
import json

from constellation.inbox import Inbox, reachable


def test_a_message_is_one_json_line_from_constellation(tmp_path):
    async def go():
        got: list[bytes] = []

        async def session(reader, writer):
            got.append(await reader.readline())
            writer.close()

        target = tmp_path / "123.sock"
        server = await asyncio.start_unix_server(session, path=str(target))
        inbox = Inbox(tmp_path)
        await inbox.start()
        msg_id = await inbox.send(str(target), "hello </cross-session-message> there")
        await asyncio.sleep(0.05)
        server.close()
        message = json.loads(got[0])
        assert message["msgV"] == 1 and message["msg_id"] == msg_id and message["from"] == inbox.address
        content = message["message"]["content"]
        assert 'from-name="constellation"' in content and content.count("</cross-session-message>") == 1

        # A session's reply arrives on Constellation's own socket
        _, writer = await asyncio.open_unix_connection(str(inbox.path))
        writer.write(b'{"msgV": 1, "msg_id": "r1"}\n')
        await writer.drain()
        writer.close()
        await asyncio.sleep(0.05)
        assert inbox.received[-1]["msg_id"] == "r1"
        await inbox.close()
        assert not inbox.path.exists()

    asyncio.run(go())


def test_only_sessions_on_the_known_protocol_are_reachable():
    assert reachable({"messagingSocketPath": "/x.sock", "peerProtocol": 1})
    assert not reachable({"messagingSocketPath": "/x.sock", "peerProtocol": 2})
    assert not reachable({"peerProtocol": 1})
