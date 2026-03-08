export type RuntimeOptions = {
  autoDemo: boolean;
  demoExit: boolean;
  disableGpu: boolean;
};

function readBooleanEnv(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

export function loadRuntimeOptions(): RuntimeOptions {
  const enableGpu = readBooleanEnv('ASEC_ENABLE_GPU');
  return {
    autoDemo: readBooleanEnv('ASEC_AUTODEMO'),
    demoExit: readBooleanEnv('ASEC_DEMO_EXIT'),
    disableGpu: !enableGpu && readBooleanEnv('ASEC_DISABLE_GPU'),
  };
}

export function shouldUseRendererDevServer(
  env: NodeJS.ProcessEnv,
): boolean {
  return (
    typeof env.VITE_DEV_SERVER_URL === 'string'
    && env.VITE_DEV_SERVER_URL.trim().length > 0
  );
}
