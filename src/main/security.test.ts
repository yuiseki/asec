import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  decryptWithPrivateKey,
  expandHomePath,
  loadPasswordCandidates,
  normalizePasswordText,
  passwordMatchesCandidates,
  resolveSecurityPaths,
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

describe('resolveSecurityPaths', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses asec-specific env overrides first', () => {
    vi.stubEnv('HOME', '/tmp/example-home');
    vi.stubEnv('ASEC_BIOMETRIC_PASSWORD_FILE', '/custom/password.enc');
    vi.stubEnv('ASEC_BIOMETRIC_PASSWORD_PRIVATE_KEY', '/custom/private.key');
    vi.stubEnv('ASEC_BIOMETRIC_UNLOCK_SIGNAL_FILE', '/custom/unlock.signal');

    expect(resolveSecurityPaths()).toEqual({
      passwordFile: '/custom/password.enc',
      privateKey: '/custom/private.key',
      unlockSignalFile: '/custom/unlock.signal',
    });
  });

  it('falls back to existing whisper agent biometric env names', () => {
    vi.stubEnv('HOME', '/tmp/example-home');
    vi.stubEnv('WHISPER_AGENT_BIOMETRIC_PASSWORD_FILE', '/legacy/password.enc');
    vi.stubEnv('WHISPER_AGENT_BIOMETRIC_PASSWORD_PRIVATE_KEY', '/legacy/private.key');
    vi.stubEnv('WHISPER_AGENT_BIOMETRIC_UNLOCK_SIGNAL_FILE', '/legacy/unlock.signal');

    expect(resolveSecurityPaths()).toEqual({
      passwordFile: '/legacy/password.enc',
      privateKey: '/legacy/private.key',
      unlockSignalFile: '/legacy/unlock.signal',
    });
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

  it('uses environment overrides when no explicit path is passed', async () => {
    vi.stubEnv('ASEC_BIOMETRIC_UNLOCK_SIGNAL_FILE', '/tmp/asec-env/unlock.signal');

    await writeUnlockSignal(undefined, {
      promises: {
        mkdir: mkdirMock,
        writeFile: writeFileMock,
      },
    });

    expect(mkdirMock).toHaveBeenCalledWith('/tmp/asec-env', {
      recursive: true,
    });
    const firstCall = writeFileMock.mock.calls[0] as unknown as [
      string,
      string,
      BufferEncoding,
    ] | undefined;
    expect(firstCall?.[0]).toBe('/tmp/asec-env/unlock.signal');
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

describe('decryptWithPrivateKey', () => {
  function createFsLike() {
    return {
      existsSync: vi.fn(() => true),
      promises: {
        chmod: vi.fn(async () => undefined),
        copyFile: vi.fn(async () => undefined),
        mkdtemp: vi.fn(async () => '/tmp/asec-password-test'),
        mkdir: vi.fn(async () => undefined),
        readFile: vi.fn(async () => ''),
        rm: vi.fn(async () => undefined),
        writeFile: vi.fn(async () => undefined),
      },
    };
  }

  it('normalizes OpenSSH private keys to PEM before invoking openssl', async () => {
    const fsLike = createFsLike();
    const execFile = vi.fn((
      file: string,
      _args: string[],
      callback: (error: Error | null, stdout?: string, stderr?: string) => void,
    ) => {
      if (file === 'ssh-keygen') {
        callback(null, '', '');
        return;
      }
      callback(null, 'secret\nsecond\n', '');
    });

    await expect(
      decryptWithPrivateKey(
        '/home/yuiseki/.ssh/google_compute_engine',
        Buffer.from('cipher'),
        {
          fsLike,
          tmpdir: () => '/tmp',
          execFile,
        },
      ),
    ).resolves.toBe('secret\nsecond\n');

    expect(execFile).toHaveBeenCalledTimes(2);
    expect(execFile).toHaveBeenNthCalledWith(
      1,
      'ssh-keygen',
      [
        '-p',
        '-m',
        'PEM',
        '-N',
        '',
        '-P',
        '',
        '-f',
        '/tmp/asec-password-test/key',
        '-q',
      ],
      expect.any(Function),
    );
    expect(execFile).toHaveBeenNthCalledWith(
      2,
      'openssl',
      [
        'pkeyutl',
        '-decrypt',
        '-inkey',
        '/tmp/asec-password-test/key',
        '-in',
        '/tmp/asec-password-test/cipher.bin',
        '-pkeyopt',
        'rsa_padding_mode:oaep',
        '-pkeyopt',
        'rsa_oaep_md:sha256',
      ],
      expect.any(Function),
    );
    expect(fsLike.promises.rm).toHaveBeenCalledWith('/tmp/asec-password-test', {
      recursive: true,
      force: true,
    });
  });
});
