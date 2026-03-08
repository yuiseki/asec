from __future__ import annotations

import json
import socket
import sys
from pathlib import Path
from unittest import mock


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from asec.ipc_client import AsecLockScreenIpcClient


class _FakeSocket:
    def __init__(self, response: bytes) -> None:
        self.response = response
        self.sent = b""
        self.timeout: float | None = None
        self.shutdown_called = False

    def __enter__(self) -> "_FakeSocket":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:  # noqa: ANN001
        return None

    def settimeout(self, timeout: float) -> None:
        self.timeout = timeout

    def sendall(self, data: bytes) -> None:
        self.sent += data

    def shutdown(self, how: int) -> None:
        assert how == socket.SHUT_WR
        self.shutdown_called = True

    def recv(self, _size: int) -> bytes:
        response, self.response = self.response, b""
        return response


def test_prepare_logs_when_enabled() -> None:
    logs: list[str] = []
    client = AsecLockScreenIpcClient(
        enabled=True,
        host="127.0.0.1",
        port=47833,
        timeout_sec=2.0,
        logger=logs.append,
    )

    client.prepare()

    assert logs == ["lock screen IPC enabled: 127.0.0.1:47833 timeoutSec=2.0"]


def test_show_lock_screen_posts_expected_payload() -> None:
    fake_socket = _FakeSocket(b'{"ok": true}\n')

    with mock.patch("asec.ipc_client.socket.create_connection", return_value=fake_socket):
        client = AsecLockScreenIpcClient(
            enabled=True,
            host="127.0.0.1",
            port=47833,
            timeout_sec=1.0,
            logger=lambda _msg: None,
        )
        client.show_lock_screen(text="SYSTEM LOCKED")

    assert fake_socket.timeout == 5.0
    assert json.loads(fake_socket.sent.decode("utf-8")) == {
        "type": "lock_screen_show",
        "text": "SYSTEM LOCKED",
    }


def test_hide_lock_screen_is_noop_when_disabled() -> None:
    client = AsecLockScreenIpcClient(
        enabled=False,
        host="127.0.0.1",
        port=47833,
        timeout_sec=1.0,
        logger=lambda _msg: None,
    )

    with mock.patch.object(client, "_request") as request_mock:
        client.hide_lock_screen()

    request_mock.assert_not_called()
