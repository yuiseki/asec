import type { BrowserWindowConstructorOptions } from 'electron';

export function buildSecurityWindowOptions(): BrowserWindowConstructorOptions {
  return {
    width: 1920,
    height: 1080,
    resizable: false,
    maximizable: false,
    minimizable: false,
    closable: true,
    fullscreen: false,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: true,
    hasShadow: false,
    show: false,
    backgroundColor: '#060810',
    title: 'asec lock screen',
    webPreferences: {
      preload: '',
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      backgroundThrottling: false,
    },
  };
}
