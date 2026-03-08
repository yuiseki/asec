# asec

Electron + React + TypeScript で実装した lock screen / security surface です。

## Current Scope

- `tmp/tauri-caption-overlay-poc` の lock screen UI を移植
- newline-delimited JSON over TCP の `lock_screen_show` / `lock_screen_hide` をサポート
- password submit で local unlock signal file を書く
- lock 中の audio mute / unlock 時の unmute を担当
- 起動時に stale mute を解除して lock crash 後の無音残留を回復する
- 既定ポートは `127.0.0.1:47833`

## Commands

```bash
npm install
npm test
npm run build
npm run dev
npm run demo
npm run start:bridge -- --tcp-port 47833
```

`npm run demo` は desktop session の `DISPLAY` / `XAUTHORITY` を自動検出し、build 後に lock screen demo を 1 回表示して自動終了します。

`npm run start:bridge` は `tmp/tauri-caption-overlay-poc/lock_screen_bridge.py` に近い CLI を受け付ける互換 entrypoint です。少なくとも次の flag を受けられます。

- `--tcp-port`
- `--biometric-password-file`
- `--biometric-password-private-key`
- `--biometric-unlock-signal`

`--ws-port` / `--http-port` / `--debug` は互換のため受け付けますが、Electron 実装では無視します。

明示指定したい場合:

```bash
ASEC_DISPLAY=:0 \
ASEC_XAUTHORITY=/run/user/1000/gdm/Xauthority \
npm run demo
```

## IPC

1 行 JSON を TCP で送ります。

### `lock_screen_show`

```json
{"type":"lock_screen_show","text":"SYSTEM LOCKED"}
```

- fullscreen lock window を前面表示します
- renderer 側で既存 PoC と同じ visual style を表示します

### `lock_screen_hide`

```json
{"type":"lock_screen_hide"}
```

- unlock success animation を流したあとに window を hide します

## Security Defaults

- password file: `~/.config/yuiclaw/biometric-password.enc`
- decrypt key: `~/.ssh/google_compute_engine`
- unlock signal: `~/.cache/yuiclaw/biometric-unlock.signal`

環境変数 override:

- `ASEC_BIOMETRIC_PASSWORD_FILE`
- `ASEC_BIOMETRIC_PASSWORD_PRIVATE_KEY`
- `ASEC_BIOMETRIC_UNLOCK_SIGNAL_FILE`

既存運用との互換のため、以下の既存 env 名も fallback として読めます。

- `WHISPER_AGENT_BIOMETRIC_PASSWORD_FILE`
- `WHISPER_AGENT_BIOMETRIC_PASSWORD_PRIVATE_KEY`
- `WHISPER_AGENT_BIOMETRIC_UNLOCK_SIGNAL_FILE`

## Current Runtime Integration

`tmp/whispercpp-listen/tmux_listen_only.sh start-overlay` は、caption を `repos/acaption`、lock screen を `repos/asec` から起動します。

```bash
cd /home/yuiseki/Workspaces/tmp/whispercpp-listen
./tmux_listen_only.sh start-overlay
./tmux_listen_only.sh logs-lock-screen
```

## Notes

- GUI 上での fullscreen / always-on-top / keyboard focus / audio mute は手動検証が必要です
- `acaption` とは別 repo として運用しつつ、runtime 上は `tmp/whispercpp-listen` から同時に管理されます
- `npm run demo` は既定で `ASEC_DEMO_IPC_PORT=47843` を使い、常用 port と競合しません
- `python/src/asec/ipc_client.py` には migration 向けの Python lock IPC client を置いており、`tmp/whispercpp-listen` の Wave 1 抽出で利用します
