const FLAG_TO_ENV = {
  '--tcp-port': 'ASEC_IPC_PORT',
  '--biometric-password-file': 'ASEC_BIOMETRIC_PASSWORD_FILE',
  '--biometric-password-private-key': 'ASEC_BIOMETRIC_PASSWORD_PRIVATE_KEY',
  '--biometric-unlock-signal': 'ASEC_BIOMETRIC_UNLOCK_SIGNAL_FILE',
};

const LEGACY_NOOP_FLAGS = new Set([
  '--ws-port',
  '--http-port',
]);

const LEGACY_BOOLEAN_NOOP_FLAGS = new Set([
  '--debug',
]);

const ASEC_RUNNER_FLAGS = new Set([
  '--auto-demo',
  '--exit-after-demo',
]);

function readFlagValue(argv, index, flag) {
  const value = argv[index + 1];
  if (typeof value !== 'string' || value.startsWith('--')) {
    throw new Error(`missing value for ${flag}`);
  }
  return value;
}

export function parseLegacyLockBridgeArgs(argv) {
  const envOverrides = {};
  const runnerArgs = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--help') {
      return {
        help: true,
        envOverrides,
        runnerArgs,
      };
    }

    if (token in FLAG_TO_ENV) {
      const value = readFlagValue(argv, index, token);
      envOverrides[FLAG_TO_ENV[token]] = value;
      index += 1;
      continue;
    }

    if (LEGACY_NOOP_FLAGS.has(token)) {
      readFlagValue(argv, index, token);
      index += 1;
      continue;
    }

    if (LEGACY_BOOLEAN_NOOP_FLAGS.has(token)) {
      continue;
    }

    if (ASEC_RUNNER_FLAGS.has(token)) {
      runnerArgs.push(token);
      continue;
    }

    throw new Error(`unsupported flag: ${token}`);
  }

  return {
    help: false,
    envOverrides,
    runnerArgs,
  };
}

export function formatLegacyLockBridgeUsage() {
  return [
    'Usage:',
    '  npm run start:bridge -- [--tcp-port 47833] [--biometric-password-file PATH] [--biometric-password-private-key PATH] [--biometric-unlock-signal PATH]',
    '',
    'Notes:',
    '  --ws-port / --http-port / --debug are accepted for compatibility and ignored.',
    '  --auto-demo / --exit-after-demo are forwarded to the asec runner.',
  ].join('\n');
}
