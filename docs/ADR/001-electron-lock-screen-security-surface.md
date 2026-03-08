# ADR 001: Electron Lock Screen Security Surface

## Status

Accepted

## Context

- `tmp/tauri-caption-overlay-poc` は caption overlay と lock screen UI/bridge を同居させていた
- lock screen 側にも animation と fullscreen/focus 制御があり、Tauri/WebKitGTK ではなく Electron/Chromium を使いたい
- password fallback、unlock signal、audio mute/unmute も UI surface 側に近い責務としてまとまっている

## Decision

- `repos/asec` を Electron + React + TypeScript で新規実装する
- `lock_screen_show` / `lock_screen_hide` の TCP IPC を維持する
- lock screen UI レイアウトと animation は `tmp/tauri-caption-overlay-poc/web` を踏襲する
- password submit、unlock signal file、audio mute/unmute も `asec` に集約する
- 起動時には stale mute を解除し、lock crash 後の無音残留を回復する
- password file / private key / unlock signal は `ASEC_*` env で上書きでき、既存 `WHISPER_AGENT_BIOMETRIC_*` env も fallback として読む
- 置き換えを容易にするため、legacy `lock_screen_bridge.py` に近い CLI entrypoint も持つ
- 既定ポートは legacy lock screen bridge と同じ `47833` を使う
- demo 実行時だけ `47843` を使って通常運用と競合しないようにする

## Consequences

- `acaption` と `asec` を揃えることで `tmp/tauri-caption-overlay-poc` の caption / lock screen を drop-in で置き換えられる
- `arouter` / `whispercpp-listen` は port 差し替えなしで追従できる
- GUI 上での fullscreen / focus / audio 挙動は手動検証が必要
