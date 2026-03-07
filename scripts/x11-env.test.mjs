// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  buildElectronLaunchEnv,
  parseProcEnviron,
  pickDesktopSessionEnv,
  withOverlayPortSelection,
} from './x11-env-core.mjs';

describe('parseProcEnviron', () => {
  it('parses null-separated environment text', () => {
    const parsed = parseProcEnviron(
      'DISPLAY=:0\0XAUTHORITY=/run/user/1000/gdm/Xauthority\0',
    );

    expect(parsed).toEqual({
      DISPLAY: ':0',
      XAUTHORITY: '/run/user/1000/gdm/Xauthority',
    });
  });
});

describe('pickDesktopSessionEnv', () => {
  it('prefers desktop session processes over shell defaults', () => {
    const candidate = pickDesktopSessionEnv([
      {
        processName: 'bash',
        env: {
          DISPLAY: ':1',
          XAUTHORITY: '/home/yuiseki/.Xauthority',
        },
      },
      {
        processName: 'plasmashell',
        env: {
          DISPLAY: ':0',
          XAUTHORITY: '/run/user/1000/gdm/Xauthority',
        },
      },
    ]);

    expect(candidate).toEqual({
      DISPLAY: ':0',
      XAUTHORITY: '/run/user/1000/gdm/Xauthority',
    });
  });

  it('returns null when no candidate has both values', () => {
    const candidate = pickDesktopSessionEnv([
      {
        processName: 'Xorg',
        env: {
          DISPLAY: ':0',
        },
      },
    ]);

    expect(candidate).toBeNull();
  });
});

describe('buildElectronLaunchEnv', () => {
  it('respects explicit overrides first', () => {
    const env = buildElectronLaunchEnv({
      inheritedEnv: {
        ASEC_DISPLAY: ':9',
        ASEC_XAUTHORITY: '/tmp/custom.Xauthority',
      },
      detectedEnv: {
        DISPLAY: ':0',
        XAUTHORITY: '/run/user/1000/gdm/Xauthority',
      },
    });

    expect(env.DISPLAY).toBe(':9');
    expect(env.XAUTHORITY).toBe('/tmp/custom.Xauthority');
  });

  it('falls back to detected desktop session env', () => {
    const env = buildElectronLaunchEnv({
      inheritedEnv: {},
      detectedEnv: {
        DISPLAY: ':0',
        XAUTHORITY: '/run/user/1000/gdm/Xauthority',
      },
    });

    expect(env.DISPLAY).toBe(':0');
    expect(env.XAUTHORITY).toBe('/run/user/1000/gdm/Xauthority');
  });
});

describe('withOverlayPortSelection', () => {
  it('keeps the regular port for normal launches', () => {
    const env = withOverlayPortSelection({
      inheritedEnv: {
        ASEC_IPC_PORT: '47842',
      },
      autoDemo: false,
    });

    expect(env.ASEC_IPC_PORT).toBe('47842');
  });

  it('uses a dedicated demo port when auto demo runs without an override', () => {
    const env = withOverlayPortSelection({
      inheritedEnv: {},
      autoDemo: true,
    });

    expect(env.ASEC_IPC_PORT).toBe('47843');
  });
});
