export const DEFAULT_BIOMETRIC_PASSWORD_FILE = '~/.config/yuiclaw/biometric-password.enc';
export const DEFAULT_BIOMETRIC_PASSWORD_PRIVATE_KEY = '~/.ssh/google_compute_engine';
export const DEFAULT_BIOMETRIC_UNLOCK_SIGNAL_FILE = '~/.cache/yuiclaw/biometric-unlock.signal';

type FsLike = {
  existsSync: (path: string) => boolean;
  promises: {
    chmod: (path: string, mode: number) => Promise<void>;
    copyFile: (from: string, to: string) => Promise<void>;
    mkdtemp: (prefix: string) => Promise<string>;
    mkdir: (path: string, options: { recursive: boolean }) => Promise<void>;
    readFile: (path: string, encoding: BufferEncoding) => Promise<string>;
    rm: (path: string, options: { recursive: boolean; force: boolean }) => Promise<void>;
    writeFile: (
      path: string,
      data: string | Buffer,
      encoding?: BufferEncoding,
    ) => Promise<void>;
  };
};

async function loadFs(): Promise<FsLike> {
  return await import('node:fs') as FsLike;
}

function joinPath(left: string, right: string): string {
  const normalizedLeft = left.endsWith('/') ? left.slice(0, -1) : left;
  const normalizedRight = right.startsWith('/') ? right.slice(1) : right;
  return `${normalizedLeft}/${normalizedRight}`;
}

function parentDir(path: string): string {
  const normalized = path.replace(/\/+$/u, '');
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash <= 0) {
    return '.';
  }
  return normalized.slice(0, lastSlash);
}

async function execFileAsync(
  command: string,
  args: string[],
): Promise<{ stdout: string }> {
  const [{ execFile }, { promisify }] = await Promise.all([
    import('node:child_process'),
    import('node:util'),
  ]);
  const run = promisify(execFile);
  const result = await run(command, args);
  return {
    stdout: result.stdout ?? '',
  };
}

export function normalizePasswordText(input: string): string {
  return input
    .trim()
    .split(/\s+/u)
    .join('')
    .toLowerCase();
}

export function passwordMatchesCandidates(
  input: string,
  candidates: readonly string[],
): boolean {
  const normalizedInput = normalizePasswordText(input);
  if (!normalizedInput) {
    return false;
  }
  return candidates.some((candidate) =>
    normalizePasswordText(candidate) === normalizedInput);
}

export function expandHomePath(path: string): string {
  if (path.startsWith('~/')) {
    const home = process.env.HOME ?? '';
    return joinPath(home, path.slice(2));
  }
  return path;
}

export async function loadPasswordCandidates(
  fsLike?: FsLike,
): Promise<string[]> {
  const [{ tmpdir }] = await Promise.all([
    import('node:os'),
  ]);
  const fs = fsLike ?? await loadFs();
  const passwordFile = expandHomePath(DEFAULT_BIOMETRIC_PASSWORD_FILE);
  const privateKey = expandHomePath(DEFAULT_BIOMETRIC_PASSWORD_PRIVATE_KEY);

  if (!fs.existsSync(passwordFile)) {
    throw new Error('パスワードファイルが見つかりません');
  }
  if (!fs.existsSync(privateKey)) {
    throw new Error('秘密鍵が見つかりません');
  }

  const cipherBase64 = await fs.promises.readFile(passwordFile, 'utf8');
  let cipherBytes: Buffer;
  try {
    cipherBytes = Buffer.from(cipherBase64.trim(), 'base64');
  } catch (error) {
    throw new Error(
      `ファイル読み込み失敗: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const tmpRoot = await fs.promises.mkdtemp(joinPath(tmpdir(), 'asec-password-'));
  const cipherPath = joinPath(tmpRoot, 'cipher.bin');
  const tempKeyPath = joinPath(tmpRoot, 'key');
  try {
    await fs.promises.writeFile(cipherPath, cipherBytes);
    await fs.promises.copyFile(privateKey, tempKeyPath);
    await fs.promises.chmod(tempKeyPath, 0o600);

    const { stdout } = await execFileAsync('openssl', [
      'pkeyutl',
      '-decrypt',
      '-inkey',
      tempKeyPath,
      '-in',
      cipherPath,
      '-pkeyopt',
      'rsa_padding_mode:oaep',
      '-pkeyopt',
      'rsa_oaep_md:sha256',
    ]);

    const candidates = stdout
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean);
    if (candidates.length === 0) {
      throw new Error('パスワードが空です');
    }
    return candidates;
  } catch (error) {
    throw new Error(
      `復号エラー: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    await fs.promises.rm(tmpRoot, { recursive: true, force: true });
  }
}

export async function validatePassword(password: string): Promise<void> {
  const candidates = await loadPasswordCandidates();
  if (!passwordMatchesCandidates(password, candidates)) {
    throw new Error('パスワードが一致しません。');
  }
}

export async function writeUnlockSignal(
  signalPath = expandHomePath(DEFAULT_BIOMETRIC_UNLOCK_SIGNAL_FILE),
  fsLike?: {
    promises: Pick<FsLike['promises'], 'mkdir' | 'writeFile'>;
  },
): Promise<void> {
  const fs = fsLike ?? await loadFs();
  await fs.promises.mkdir(parentDir(signalPath), { recursive: true });
  await fs.promises.writeFile(signalPath, `unlock:${Date.now()}\n`, 'utf8');
}
