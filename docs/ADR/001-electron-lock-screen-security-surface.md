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
- 既定ポートは移行期間中だけ `47843` を使う

## Consequences

- `acaption` と `asec` を揃えることで `tmp/tauri-caption-overlay-poc` を段階的に deprecated 扱いへ寄せられる
- `arouter` / `whispercpp-listen` は後から IPC port 差し替えで追従できる
- GUI 上での fullscreen / focus / audio 挙動は手動検証が必要
