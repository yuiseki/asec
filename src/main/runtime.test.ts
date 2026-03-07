import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  browserWindowState,
  browserWindowMock,
  ipcHandlerMap,
  ipcMainMock,
  lockAudioMock,
  unlockAudioMock,
  validatePasswordMock,
  writeUnlockSignalMock,
} = vi.hoisted(() => {
  const handlerMap = new Map<string, (...args: unknown[]) => Promise<unknown>>();
  const state = {
    loadFile: vi.fn(async () => undefined),
    loadURL: vi.fn(async () => undefined),
    setAlwaysOnTop: vi.fn(),
    setVisibleOnAllWorkspaces: vi.fn(),
    show: vi.fn(),
    setFullScreen: vi.fn(),
    focus: vi.fn(),
    hide: vi.fn(),
    send: vi.fn(),
  };

  const BrowserWindowMock = vi.fn(() => ({
    loadFile: state.loadFile,
    loadURL: state.loadURL,
    setAlwaysOnTop: state.setAlwaysOnTop,
    setVisibleOnAllWorkspaces: state.setVisibleOnAllWorkspaces,
    show: state.show,
    setFullScreen: state.setFullScreen,
    focus: state.focus,
    hide: state.hide,
    webContents: {
      send: state.send,
    },
  }));

  const IpcMainMock = {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
      handlerMap.set(channel, handler);
    }),
    removeHandler: vi.fn(),
  };

  return {
    browserWindowState: state,
    browserWindowMock: BrowserWindowMock,
    ipcHandlerMap: handlerMap,
    ipcMainMock: IpcMainMock,
    lockAudioMock: vi.fn(async () => undefined),
    unlockAudioMock: vi.fn(async () => undefined),
    validatePasswordMock: vi.fn(async () => undefined),
    writeUnlockSignalMock: vi.fn(async () => undefined),
  };
});

vi.mock('electron', () => ({
  BrowserWindow: browserWindowMock,
  ipcMain: ipcMainMock,
}));

vi.mock('./runtime-options', () => ({
  shouldUseRendererDevServer: () => false,
}));

vi.mock('./audio', () => ({
  lockAudio: lockAudioMock,
  unlockAudio: unlockAudioMock,
}));

vi.mock('./security', () => ({
  validatePassword: validatePasswordMock,
  writeUnlockSignal: writeUnlockSignalMock,
}));

import { AsecRuntime } from './runtime';

describe('AsecRuntime', () => {
  beforeEach(() => {
    browserWindowMock.mockClear();
    ipcMainMock.handle.mockClear();
    ipcMainMock.removeHandler.mockClear();
    ipcHandlerMap.clear();
    lockAudioMock.mockClear();
    unlockAudioMock.mockClear();
    validatePasswordMock.mockClear();
    writeUnlockSignalMock.mockClear();
    browserWindowState.loadFile.mockClear();
    browserWindowState.loadURL.mockClear();
    browserWindowState.setAlwaysOnTop.mockClear();
    browserWindowState.setVisibleOnAllWorkspaces.mockClear();
    browserWindowState.show.mockClear();
    browserWindowState.setFullScreen.mockClear();
    browserWindowState.focus.mockClear();
    browserWindowState.hide.mockClear();
    browserWindowState.send.mockClear();
  });

  it('prepares the lock window as a screen-saver surface', () => {
    new AsecRuntime();

    expect(browserWindowMock).toHaveBeenCalledOnce();
    expect(browserWindowState.setAlwaysOnTop).toHaveBeenCalledWith(true, 'screen-saver');
    expect(browserWindowState.setVisibleOnAllWorkspaces).toHaveBeenCalledWith(true, {
      visibleOnFullScreen: true,
    });
  });

  it('shows the fullscreen lock surface and forwards the lock command', async () => {
    const runtime = new AsecRuntime();
    await runtime.init();
    unlockAudioMock.mockClear();

    const rendererReady = ipcHandlerMap.get('security-surface:renderer-ready');
    expect(rendererReady).toBeTypeOf('function');
    await rendererReady?.();

    const dispatchRequest = Reflect.get(runtime, 'dispatchRequest') as (
      request: { type: 'lock_screen_show'; text: string } | { type: 'lock_screen_hide' },
    ) => Promise<void>;

    await dispatchRequest.call(runtime, {
      type: 'lock_screen_show',
      text: 'SYSTEM LOCKED',
    });

    expect(lockAudioMock).toHaveBeenCalledOnce();
    expect(browserWindowState.show).toHaveBeenCalledOnce();
    expect(browserWindowState.setAlwaysOnTop).toHaveBeenLastCalledWith(true, 'screen-saver');
    expect(browserWindowState.setVisibleOnAllWorkspaces).toHaveBeenLastCalledWith(true, {
      visibleOnFullScreen: true,
    });
    expect(browserWindowState.setFullScreen).toHaveBeenCalledWith(true);
    expect(browserWindowState.focus).toHaveBeenCalledOnce();
    expect(browserWindowState.send).toHaveBeenCalledWith('security-surface:command', {
      kind: 'lock/show',
      text: 'SYSTEM LOCKED',
    });
  });

  it('submits passwords through the security helpers', async () => {
    const runtime = new AsecRuntime();
    await runtime.init();
    unlockAudioMock.mockClear();

    const submitPassword = ipcHandlerMap.get('security-surface:submit-password');
    expect(submitPassword).toBeTypeOf('function');
    await submitPassword?.({}, 'secret passcode');

    expect(validatePasswordMock).toHaveBeenCalledWith('secret passcode');
    expect(writeUnlockSignalMock).toHaveBeenCalledOnce();
  });

  it('restores audio as soon as a hide request arrives and forwards the unlock animation command', async () => {
    const runtime = new AsecRuntime();
    await runtime.init();
    unlockAudioMock.mockClear();

    const rendererReady = ipcHandlerMap.get('security-surface:renderer-ready');
    expect(rendererReady).toBeTypeOf('function');
    await rendererReady?.();

    const dispatchRequest = Reflect.get(runtime, 'dispatchRequest') as (
      request: { type: 'lock_screen_show'; text: string } | { type: 'lock_screen_hide' },
    ) => Promise<void>;

    await dispatchRequest.call(runtime, {
      type: 'lock_screen_hide',
    });

    expect(unlockAudioMock).toHaveBeenCalledOnce();
    expect(browserWindowState.send).toHaveBeenCalledWith('security-surface:command', {
      kind: 'lock/hide',
    });
  });

  it('hides the window when the renderer finishes the unlock animation', async () => {
    const runtime = new AsecRuntime();
    await runtime.init();
    unlockAudioMock.mockClear();

    const completeHide = ipcHandlerMap.get('security-surface:complete-lock-screen-hide');
    expect(completeHide).toBeTypeOf('function');
    await completeHide?.();

    expect(unlockAudioMock).not.toHaveBeenCalled();
    expect(browserWindowState.setFullScreen).toHaveBeenCalledWith(false);
    expect(browserWindowState.hide).toHaveBeenCalledOnce();
  });

  it('unmutes stale lock audio during startup recovery', async () => {
    const runtime = new AsecRuntime();

    await runtime.init();

    expect(unlockAudioMock).toHaveBeenCalledOnce();
  });
});
