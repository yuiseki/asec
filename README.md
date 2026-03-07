# asec

Electron + React + TypeScript で実装した lock screen / security surface です。

## Current Scope

- `tmp/tauri-caption-overlay-poc` の lock screen UI を移植
- newline-delimited JSON over TCP の `lock_screen_show` / `lock_screen_hide` をサポート
- password submit で local unlock signal file を書く
- lock 中の audio mute / unlock 時の unmute を担当
- 開発中の既定ポートは `127.0.0.1:47843`

## Commands

```bash
npm install
npm test
npm run build
npm run dev
npm run demo
```

`npm run demo` は desktop session の `DISPLAY` / `XAUTHORITY` を自動検出し、build 後に lock screen demo を 1 回表示して自動終了します。

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

## Notes

- 既存 `tmp/whispercpp-listen` との切り替えはまだ未着手です
- GUI 上での fullscreen / always-on-top / keyboard focus / audio mute は手動検証が必要です
- `acaption` とは別 repo として運用し、`tmp/tauri-caption-overlay-poc` の deprecation に向けて段階移行します
