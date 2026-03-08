from __future__ import annotations

import json
import socket
from typing import Any, Callable


def _build_jsonl_line(payload: dict[str, Any]) -> bytes:
    return (json.dumps(payload, ensure_ascii=False) + "\n").encode("utf-8")


class AsecLockScreenIpcClient:
    def __init__(
        self,
        *,
        enabled: bool,
        host: str,
        port: int,
        timeout_sec: float,
        logger: Callable[[str], None],
    ) -> None:
        self.enabled = enabled
        self.host = host
        self.port = int(port)
        self.timeout_sec = float(timeout_sec)
        self.log = logger

    @property
    def endpoint(self) -> str:
        return f"{self.host}:{self.port}"

    def prepare(self) -> None:
        if not self.enabled:
            return
        self.log(f"lock screen IPC enabled: {self.endpoint} timeoutSec={self.timeout_sec:.1f}")

    def _request(self, payload: dict[str, Any], *, timeout_sec: float | None = None) -> dict[str, Any]:
        if not self.enabled:
            raise RuntimeError("lock screen IPC disabled")
        timeout = float(timeout_sec if timeout_sec is not None else self.timeout_sec)
        with socket.create_connection((self.host, self.port), timeout=timeout) as sock:
            sock.settimeout(timeout)
            sock.sendall(_build_jsonl_line(payload))
            sock.shutdown(socket.SHUT_WR)
            chunks: list[bytes] = []
            while True:
                try:
                    part = sock.recv(4096)
                except socket.timeout as exc:
                    raise RuntimeError(
                        f"lock screen IPC timeout waiting response from {self.endpoint}"
                    ) from exc
                if not part:
                    break
                chunks.append(part)
                if b"\n" in part:
                    break
        raw = b"".join(chunks).strip()
        if not raw:
            raise RuntimeError("lock screen IPC empty response")
        response = json.loads(raw.decode("utf-8"))
        if not bool(response.get("ok", False)):
            message = response.get("error") or "unknown lock screen IPC error"
            raise RuntimeError(f"lock screen IPC request failed: {message}")
        return response

    def show_lock_screen(self, *, text: str) -> None:
        if not self.enabled:
            return
        self._request(
            {
                "type": "lock_screen_show",
                "text": str(text),
            },
            timeout_sec=max(self.timeout_sec, 5.0),
        )

    def hide_lock_screen(self) -> None:
        if not self.enabled:
            return
        self._request(
            {
                "type": "lock_screen_hide",
            },
            timeout_sec=max(self.timeout_sec, 5.0),
        )
