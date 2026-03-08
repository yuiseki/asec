import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SECURITY_PORT,
  parseSecurityRequestLine,
} from './ipc';

describe('parseSecurityRequestLine', () => {
  it('parses lock screen show requests', () => {
    const result = parseSecurityRequestLine(
      '{"type":"lock_screen_show","text":"SYSTEM LOCKED"}',
    );

    expect(result).toEqual({
      type: 'lock_screen_show',
      text: 'SYSTEM LOCKED',
    });
  });

  it('parses lock screen hide requests', () => {
    const result = parseSecurityRequestLine(
      '{"type":"lock_screen_hide"}',
    );

    expect(result).toEqual({
      type: 'lock_screen_hide',
    });
  });

  it('rejects non-security speak requests', () => {
    expect(() =>
      parseSecurityRequestLine(
        '{"type":"speak","text":"承知しました","wav_path":"/tmp/ack.wav"}',
      ),
    ).toThrowError('unsupported request type: speak');
  });

  it('rejects blank lock screen show text', () => {
    expect(() =>
      parseSecurityRequestLine('{"type":"lock_screen_show","text":"  "}'),
    ).toThrowError('lock_screen_show request missing text');
  });
});

describe('security defaults', () => {
  it('uses the legacy lock screen IPC port for drop-in compatibility', () => {
    expect(DEFAULT_SECURITY_PORT).toBe(47833);
  });
});
