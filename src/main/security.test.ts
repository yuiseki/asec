import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  expandHomePath,
  loadPasswordCandidates,
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

describe('loadPasswordCandidates', () => {
  function createFsLike(overrides?: {
    existsSync?: (path: string) => boolean;
    readFile?: (path: string, encoding: BufferEncoding) => Promise<string>;
  }) {
    return {
      existsSync: overrides?.existsSync ?? (() => true),
      promises: {
        chmod: vi.fn(async () => undefined),
        copyFile: vi.fn(async () => undefined),
        mkdtemp: vi.fn(async () => '/tmp/asec-password-test'),
        mkdir: vi.fn(async () => undefined),
        readFile: overrides?.readFile ?? vi.fn(async () => Buffer.from('cipher').toString('base64')),
        rm: vi.fn(async () => undefined),
        writeFile: vi.fn(async () => undefined),
      },
    };
  }

  it('rejects missing password files before decrypting', async () => {
    const fsLike = createFsLike({
      existsSync: (path) => !path.endsWith('biometric-password.enc'),
    });

    await expect(
      loadPasswordCandidates({
        fsLike,
        decryptWithPrivateKey: vi.fn(async () => 'secret'),
      }),
    ).rejects.toThrowError('パスワードファイルが見つかりません');
  });

  it('rejects missing private keys before decrypting', async () => {
    const fsLike = createFsLike({
      existsSync: (path) => !path.endsWith('google_compute_engine'),
    });

    await expect(
      loadPasswordCandidates({
        fsLike,
        decryptWithPrivateKey: vi.fn(async () => 'secret'),
      }),
    ).rejects.toThrowError('秘密鍵が見つかりません');
  });

  it('rejects invalid base64 before attempting decrypt', async () => {
    const decryptWithPrivateKey = vi.fn(async () => 'secret');
    const fsLike = createFsLike({
      readFile: vi.fn(async () => '!!!not-base64!!!'),
    });

    await expect(
      loadPasswordCandidates({
        fsLike,
        decryptWithPrivateKey,
      }),
    ).rejects.toThrowError(/ファイル読み込み失敗/u);

    expect(decryptWithPrivateKey).not.toHaveBeenCalled();
  });

  it('rejects empty decrypted candidate lists', async () => {
    const fsLike = createFsLike();

    await expect(
      loadPasswordCandidates({
        fsLike,
        decryptWithPrivateKey: vi.fn(async () => '\n \n'),
      }),
    ).rejects.toThrowError('パスワードが空です');
  });

  it('returns trimmed decrypted candidates', async () => {
    const fsLike = createFsLike();

    await expect(
      loadPasswordCandidates({
        fsLike,
        decryptWithPrivateKey: vi.fn(async () => ' secret \npass code\n'),
      }),
    ).resolves.toEqual(['secret', 'pass code']);
  });
});
