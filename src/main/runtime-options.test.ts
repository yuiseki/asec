import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  loadRuntimeOptions,
  shouldUseRendererDevServer,
} from './runtime-options';

describe('loadRuntimeOptions', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults demo mode off', () => {
    const options = loadRuntimeOptions();

    expect(options.autoDemo).toBe(false);
    expect(options.demoExit).toBe(false);
    expect(options.disableGpu).toBe(false);
  });

  it('enables auto demo and exit from environment flags', () => {
    vi.stubEnv('ASEC_AUTODEMO', '1');
    vi.stubEnv('ASEC_DEMO_EXIT', 'true');

    const options = loadRuntimeOptions();

    expect(options.autoDemo).toBe(true);
    expect(options.demoExit).toBe(true);
    expect(options.disableGpu).toBe(false);
  });

  it('allows disabling GPU explicitly for debugging', () => {
    vi.stubEnv('ASEC_DISABLE_GPU', '1');

    const options = loadRuntimeOptions();

    expect(options.disableGpu).toBe(true);
  });

  it('lets ASEC_ENABLE_GPU override a disable request', () => {
    vi.stubEnv('ASEC_DISABLE_GPU', '1');
    vi.stubEnv('ASEC_ENABLE_GPU', '1');

    const options = loadRuntimeOptions();

    expect(options.disableGpu).toBe(false);
  });
});

describe('shouldUseRendererDevServer', () => {
  it('uses the dev server only when VITE_DEV_SERVER_URL is present', () => {
    expect(
      shouldUseRendererDevServer({
        VITE_DEV_SERVER_URL: 'http://localhost:5173',
      }),
    ).toBe(true);

    expect(
      shouldUseRendererDevServer({
        NODE_ENV: 'development',
      }),
    ).toBe(false);
  });
});
