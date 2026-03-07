// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  formatLegacyLockBridgeUsage,
  parseLegacyLockBridgeArgs,
} from './lock-bridge-compat-core.mjs';

describe('parseLegacyLockBridgeArgs', () => {
  it('maps legacy lock bridge flags to asec environment variables', () => {
    const parsed = parseLegacyLockBridgeArgs([
      '--tcp-port', '47833',
      '--biometric-password-file', '/tmp/password.enc',
      '--biometric-password-private-key', '/tmp/private.key',
      '--biometric-unlock-signal', '/tmp/unlock.signal',
    ]);

    expect(parsed.envOverrides).toEqual({
      ASEC_IPC_PORT: '47833',
      ASEC_BIOMETRIC_PASSWORD_FILE: '/tmp/password.enc',
      ASEC_BIOMETRIC_PASSWORD_PRIVATE_KEY: '/tmp/private.key',
      ASEC_BIOMETRIC_UNLOCK_SIGNAL_FILE: '/tmp/unlock.signal',
    });
    expect(parsed.runnerArgs).toEqual([]);
  });

  it('accepts legacy no-op flags and asec demo passthrough flags', () => {
    const parsed = parseLegacyLockBridgeArgs([
      '--ws-port', '18766',
      '--http-port', '18765',
      '--debug',
      '--auto-demo',
      '--exit-after-demo',
    ]);

    expect(parsed.envOverrides).toEqual({});
    expect(parsed.runnerArgs).toEqual(['--auto-demo', '--exit-after-demo']);
  });

  it('returns help metadata for --help', () => {
    const parsed = parseLegacyLockBridgeArgs(['--help']);

    expect(parsed.help).toBe(true);
    expect(parsed.envOverrides).toEqual({});
  });

  it('rejects unknown flags', () => {
    expect(() =>
      parseLegacyLockBridgeArgs(['--unknown-flag']),
    ).toThrowError('unsupported flag: --unknown-flag');
  });

  it('rejects missing values for flags that require one', () => {
    expect(() =>
      parseLegacyLockBridgeArgs(['--tcp-port']),
    ).toThrowError('missing value for --tcp-port');
  });
});

describe('formatLegacyLockBridgeUsage', () => {
  it('mentions the legacy-compatible entrypoint', () => {
    expect(formatLegacyLockBridgeUsage()).toContain('npm run start:bridge --');
    expect(formatLegacyLockBridgeUsage()).toContain('--tcp-port');
  });
});
