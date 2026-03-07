import { app } from 'electron';

import { loadRuntimeOptions } from './runtime-options';
import { AsecRuntime } from './runtime';

app.commandLine.appendSwitch('no-sandbox');

let runtime: AsecRuntime | null = null;
const runtimeOptions = loadRuntimeOptions();

async function bootstrap(): Promise<void> {
  runtime = new AsecRuntime();
  await runtime.init();
  await runtime.startServer();
  if (runtimeOptions.autoDemo) {
    try {
      await runtime.playDemo();
    } finally {
      if (runtimeOptions.demoExit) {
        app.quit();
      }
    }
  }
}

app.whenReady().then(() => {
  void bootstrap().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    app.exit(1);
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  if (runtime) {
    void runtime.stop();
  }
});
