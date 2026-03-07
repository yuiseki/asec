import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import {
  DESKTOP_PROCESS_PRIORITY,
  buildElectronLaunchEnv,
  parseProcEnviron,
  pickDesktopSessionEnv,
  withOverlayPortSelection,
} from './x11-env-core.mjs';

async function readProcessName(procRoot, pid) {
  try {
    return (await readFile(join(procRoot, pid, 'comm'), 'utf8')).trim();
  } catch {
    return null;
  }
}

async function readProcessEnv(procRoot, pid) {
  try {
    const raw = await readFile(join(procRoot, pid, 'environ'), 'utf8');
    return parseProcEnviron(raw);
  } catch {
    return null;
  }
}

export async function discoverDesktopSessionEnv({ procRoot = '/proc' } = {}) {
  const entries = await readdir(procRoot, { withFileTypes: true });
  const candidates = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) {
      continue;
    }

    const processName = await readProcessName(procRoot, entry.name);
    if (!processName) {
      continue;
    }
    if (!DESKTOP_PROCESS_PRIORITY.includes(processName)) {
      continue;
    }

    const env = await readProcessEnv(procRoot, entry.name);
    if (!env) {
      continue;
    }

    candidates.push({
      processName,
      env,
    });
  }

  return pickDesktopSessionEnv(candidates);
}

export {
  buildElectronLaunchEnv,
  parseProcEnviron,
  pickDesktopSessionEnv,
  withOverlayPortSelection,
};
