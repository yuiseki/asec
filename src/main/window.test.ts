import { describe, expect, it } from 'vitest';

import { buildSecurityWindowOptions } from './window';

describe('buildSecurityWindowOptions', () => {
  it('matches fullscreen lock screen defaults', () => {
    const options = buildSecurityWindowOptions();

    expect(options.width).toBe(1920);
    expect(options.height).toBe(1080);
    expect(options.transparent).toBe(false);
    expect(options.frame).toBe(false);
    expect(options.skipTaskbar).toBe(true);
    expect(options.focusable).toBe(true);
  });
});
