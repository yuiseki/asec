// @vitest-environment node

import { describe, expect, it } from 'vitest';

const fs = process.getBuiltinModule?.('fs');

if (!fs) {
  throw new Error('Node builtin fs module is unavailable');
}

const styles = fs.readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

describe('styles.css', () => {
  it('keeps the React root full-size for fullscreen lock layout', () => {
    expect(styles).toContain('#root {');
    expect(styles).toContain('width: 100%;');
    expect(styles).toContain('height: 100%;');
  });
});
