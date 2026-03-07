import { createServer, type Server, type Socket } from 'node:net';
import { join } from 'node:path';

import {
  BrowserWindow,
  ipcMain,
  type BrowserWindowConstructorOptions,
} from 'electron';

import type { SecurityRendererCommand } from '../shared/events';
import {
  DEFAULT_SECURITY_PORT,
  parseSecurityRequestLine,
  type SecurityRequest,
} from '../shared/ipc';

import { lockAudio, unlockAudio } from './audio';
import { shouldUseRendererDevServer } from './runtime-options';
import { validatePassword, writeUnlockSignal } from './security';
import { buildSecurityWindowOptions } from './window';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

class SequentialJobQueue {
  private tail: Promise<void> = Promise.resolve();

  enqueue(job: () => Promise<void>): Promise<void> {
    const next = this.tail.then(job, job);
    this.tail = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }
}

export class AsecRuntime {
  private readonly isDev = shouldUseRendererDevServer(process.env);
  private readonly queue = new SequentialJobQueue();
  private readonly rendererReady = createDeferred<void>();
  private readonly securityWindow: BrowserWindow;
  private server: Server | null = null;
  private rendererReadySettled = false;

  constructor() {
    const preloadPath = join(__dirname, '../preload/index.js');
    const options = buildSecurityWindowOptions();
    this.securityWindow = new BrowserWindow({
      ...options,
      webPreferences: {
        ...options.webPreferences,
        preload: preloadPath,
      },
    } satisfies BrowserWindowConstructorOptions);

    this.securityWindow.setAlwaysOnTop(true, 'screen-saver');
    this.securityWindow.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
    });
  }

  async init(): Promise<void> {
    this.registerIpcHandlers();
    if (this.isDev) {
      const rendererUrl = process.env.VITE_DEV_SERVER_URL;
      if (!rendererUrl) {
        throw new Error('missing VITE_DEV_SERVER_URL');
      }
      await this.securityWindow.loadURL(rendererUrl);
    } else {
      await this.securityWindow.loadFile(
        join(__dirname, '../renderer/index.html'),
      );
    }
  }

  async startServer(): Promise<void> {
    if (this.server) {
      return;
    }

    const host = process.env.ASEC_IPC_HOST ?? '127.0.0.1';
    const port = Number.parseInt(
      process.env.ASEC_IPC_PORT ?? String(DEFAULT_SECURITY_PORT),
      10,
    );

    this.server = createServer((socket) => {
      void this.handleSocket(socket);
    });

    await new Promise<void>((resolve, reject) => {
      this.server?.once('error', reject);
      this.server?.listen(port, host, () => {
        this.server?.off('error', reject);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }
      this.server.close(() => resolve());
      this.server = null;
    });
  }

  async playDemo(): Promise<void> {
    await this.dispatchRequest({
      type: 'lock_screen_show',
      text: 'SYSTEM LOCKED',
    });
    await new Promise((resolve) => {
      setTimeout(resolve, 1400);
    });
    await this.dispatchRequest({
      type: 'lock_screen_hide',
    });
    await new Promise((resolve) => {
      setTimeout(resolve, 3200);
    });
  }

  private registerIpcHandlers(): void {
    ipcMain.removeHandler('security-surface:renderer-ready');
    ipcMain.removeHandler('security-surface:submit-password');
    ipcMain.removeHandler('security-surface:complete-lock-screen-hide');
    ipcMain.removeHandler('security-surface:play-demo');

    ipcMain.handle('security-surface:renderer-ready', async () => {
      if (!this.rendererReadySettled) {
        this.rendererReady.resolve();
        this.rendererReadySettled = true;
      }
      return { ok: true };
    });

    ipcMain.handle('security-surface:submit-password', async (_event, password: string) => {
      await validatePassword(password);
      await writeUnlockSignal();
      return { ok: true };
    });

    ipcMain.handle('security-surface:complete-lock-screen-hide', async () => {
      await unlockAudio();
      this.securityWindow.setFullScreen(false);
      this.securityWindow.hide();
      return { ok: true };
    });

    ipcMain.handle('security-surface:play-demo', async () => {
      await this.playDemo();
      return { ok: true };
    });
  }

  private async handleSocket(socket: Socket): Promise<void> {
    socket.setEncoding('utf8');
    socket.setTimeout(5000);

    let buffer = '';
    let handled = false;

    const finalize = async (line: string): Promise<void> => {
      if (handled) {
        return;
      }
      handled = true;
      try {
        const request = parseSecurityRequestLine(line);
        void this.queue.enqueue(async () => {
          await this.dispatchRequest(request);
        });
        this.writeSocketResponse(socket, {
          ok: true,
          queued: true,
          error: null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.writeSocketResponse(socket, {
          ok: false,
          queued: false,
          error: message,
        });
      }
    };

    socket.on('data', (chunk) => {
      buffer += chunk;
      const newlineIndex = buffer.indexOf('\n');
      if (newlineIndex >= 0) {
        socket.pause();
        void finalize(buffer.slice(0, newlineIndex)).finally(() => {
          socket.end();
        });
      }
    });

    socket.on('timeout', () => {
      if (!handled) {
        this.writeSocketResponse(socket, {
          ok: false,
          queued: false,
          error: 'request timeout',
        });
      }
      socket.end();
    });

    socket.on('end', () => {
      if (!handled && buffer.trim()) {
        void finalize(buffer).finally(() => {
          socket.end();
        });
      }
    });
  }

  private async dispatchRequest(request: SecurityRequest): Promise<void> {
    await this.rendererReady.promise;
    switch (request.type) {
      case 'lock_screen_show':
        await lockAudio();
        this.securityWindow.show();
        this.securityWindow.setAlwaysOnTop(true, 'screen-saver');
        this.securityWindow.setVisibleOnAllWorkspaces(true, {
          visibleOnFullScreen: true,
        });
        this.securityWindow.setFullScreen(true);
        this.securityWindow.focus();
        this.sendCommand({
          kind: 'lock/show',
          text: request.text,
        });
        break;
      case 'lock_screen_hide':
        this.sendCommand({
          kind: 'lock/hide',
        });
        break;
    }
  }

  private sendCommand(command: SecurityRendererCommand): void {
    this.securityWindow.webContents.send('security-surface:command', command);
  }

  private writeSocketResponse(
    socket: Socket,
    response: { ok: boolean; queued: boolean; error: string | null },
  ): void {
    socket.write(`${JSON.stringify(response)}\n`);
  }
}
