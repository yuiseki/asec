import type { SecurityRendererCommand } from './events';

export type SecuritySurfaceApi = {
  onCommand: (
    listener: (command: SecurityRendererCommand) => void,
  ) => () => void;
  rendererReady: () => Promise<{ ok: boolean }>;
  submitPassword: (
    password: string,
  ) => Promise<{ ok: boolean }>;
  completeLockScreenHide: () => Promise<{ ok: boolean }>;
  playDemo: () => Promise<{ ok: boolean }>;
};
