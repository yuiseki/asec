import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  expandHomePath,
  normalizePasswordText,
  passwordMatchesCandidates,
  writeUnlockSignal,
} from './security';

describe('normalizePasswordText', () => {
  it('removes whitespace and lowercases text', () => {
    expect(normalizePasswordText('  Pa Ss Word  ')).toBe('password');
  });
});

describe('passwordMatchesCandidates', () => {
  it('matches normalized candidates', () => {
    expect(
      passwordMatchesCandidates(' パス ワード ', ['nope', 'パスワード']),
    ).toBe(true);
  });

  it('rejects blank input', () => {
    expect(passwordMatchesCandidates('   ', ['パスワード'])).toBe(false);
  });
});

describe('expandHomePath', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('expands ~/ with HOME', () => {
    vi.stubEnv('HOME', '/tmp/example-home');
    expect(expandHomePath('~/.cache/test.signal')).toBe(
      '/tmp/example-home/.cache/test.signal',
    );
  });
});

describe('writeUnlockSignal', () => {
  const mkdirMock = vi.fn(async () => undefined);
  const writeFileMock = vi.fn(async () => undefined);

  afterEach(() => {
    mkdirMock.mockClear();
    writeFileMock.mockClear();
  });

  it('creates the parent directory and writes an unlock marker', async () => {
    const signalPath = '/tmp/asec-test/unlock.signal';
    await writeUnlockSignal(signalPath, {
      promises: {
        mkdir: mkdirMock,
        writeFile: writeFileMock,
      },
    });

    expect(mkdirMock).toHaveBeenCalledWith('/tmp/asec-test', {
      recursive: true,
    });
    expect(writeFileMock).toHaveBeenCalledOnce();
    const firstCall = writeFileMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const [writtenPath, contents, encoding] = firstCall as unknown as [
      string,
      string,
      BufferEncoding,
    ];
    expect(writtenPath).toBe(signalPath);
    expect(String(contents)).toMatch(/^unlock:\d+\n$/);
    expect(encoding).toBe('utf8');
  });
});
