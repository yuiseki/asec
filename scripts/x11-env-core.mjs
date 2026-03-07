const DESKTOP_PROCESS_PRIORITY = [
  'plasmashell',
  'kwin_x11',
  'kwin_wayland',
  'startplasma-x11',
  'startplasma-wayland',
  'Xorg',
  'Xwayland',
];

function normalizeEnvValue(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function parseProcEnviron(raw) {
  const env = {};
  for (const entry of String(raw).split('\0')) {
    if (!entry) {
      continue;
    }
    const separatorIndex = entry.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }
    const key = entry.slice(0, separatorIndex);
    const value = entry.slice(separatorIndex + 1);
    env[key] = value;
  }
  return env;
}

export function pickDesktopSessionEnv(candidates) {
  const sortedCandidates = [...candidates].sort((left, right) => {
    const leftPriority = DESKTOP_PROCESS_PRIORITY.indexOf(left.processName);
    const rightPriority = DESKTOP_PROCESS_PRIORITY.indexOf(right.processName);
    const leftScore = leftPriority >= 0 ? leftPriority : DESKTOP_PROCESS_PRIORITY.length;
    const rightScore = rightPriority >= 0 ? rightPriority : DESKTOP_PROCESS_PRIORITY.length;
    return leftScore - rightScore;
  });

  for (const candidate of sortedCandidates) {
    const display = normalizeEnvValue(candidate.env.DISPLAY);
    const xauthority = normalizeEnvValue(candidate.env.XAUTHORITY);
    if (display && xauthority) {
      return {
        DISPLAY: display,
        XAUTHORITY: xauthority,
      };
    }
  }

  return null;
}

export function buildElectronLaunchEnv({ inheritedEnv, detectedEnv }) {
  return {
    ...inheritedEnv,
    DISPLAY:
      normalizeEnvValue(inheritedEnv.ASEC_DISPLAY) ??
      normalizeEnvValue(inheritedEnv.DISPLAY) ??
      normalizeEnvValue(detectedEnv?.DISPLAY) ??
      ':0',
    XAUTHORITY:
      normalizeEnvValue(inheritedEnv.ASEC_XAUTHORITY) ??
      normalizeEnvValue(inheritedEnv.XAUTHORITY) ??
      normalizeEnvValue(detectedEnv?.XAUTHORITY) ??
      `${inheritedEnv.HOME ?? ''}/.Xauthority`,
  };
}

export function withOverlayPortSelection({ inheritedEnv, autoDemo }) {
  if (
    typeof inheritedEnv.ASEC_IPC_PORT === 'string' &&
    inheritedEnv.ASEC_IPC_PORT.trim()
  ) {
    return inheritedEnv;
  }

  if (!autoDemo) {
    return inheritedEnv;
  }

  return {
    ...inheritedEnv,
    ASEC_IPC_PORT:
      inheritedEnv.ASEC_DEMO_IPC_PORT ?? '47843',
  };
}

export { DESKTOP_PROCESS_PRIORITY };
