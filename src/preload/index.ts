import { contextBridge, ipcRenderer } from 'electron';

import type { SecurityRendererCommand } from '../shared/events';
import type { SecuritySurfaceApi } from '../shared/security-surface-api';

const securitySurfaceApi: SecuritySurfaceApi = {
  onCommand(listener) {
    const wrapped = (
      _event: Electron.IpcRendererEvent,
      payload: SecurityRendererCommand,
    ) => {
      listener(payload);
    };
    ipcRenderer.on('security-surface:command', wrapped);
    return () => {
      ipcRenderer.removeListener('security-surface:command', wrapped);
    };
  },
  rendererReady() {
    return ipcRenderer.invoke('security-surface:renderer-ready');
  },
  submitPassword(password) {
    return ipcRenderer.invoke('security-surface:submit-password', password);
  },
  completeLockScreenHide() {
    return ipcRenderer.invoke('security-surface:complete-lock-screen-hide');
  },
  playDemo() {
    return ipcRenderer.invoke('security-surface:play-demo');
  },
};

contextBridge.exposeInMainWorld('securitySurfaceApi', securitySurfaceApi);
