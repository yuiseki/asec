import { spawn } from 'node:child_process';
import { join } from 'node:path';

import {
  formatLegacyLockBridgeUsage,
  parseLegacyLockBridgeArgs,
} from './lock-bridge-compat-core.mjs';

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      ...options,
    });

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`${command} exited with signal ${signal}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`${command} exited with code ${code}`));
        return;
      }
      resolve();
    });
  });
}

async function main() {
  let parsed;
  try {
    parsed = parseLegacyLockBridgeArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error();
    console.error(formatLegacyLockBridgeUsage());
    process.exit(1);
  }

  if (parsed.help) {
    console.log(formatLegacyLockBridgeUsage());
    return;
  }

  const runnerPath = join(import.meta.dirname, 'run-electron-with-x11-env.mjs');
  await runCommand(process.execPath, [runnerPath, ...parsed.runnerArgs], {
    env: {
      ...process.env,
      ...parsed.envOverrides,
    },
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
