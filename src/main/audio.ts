type PactlRunner = (args: string[]) => Promise<string>;

const childProcessModule = process.getBuiltinModule?.('child_process');

if (!childProcessModule) {
  throw new Error('Node child_process module is unavailable in the Electron main runtime');
}

async function runPactl(args: string[]): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    childProcessModule.execFile('pactl', args, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout ?? '');
    });
  });
}

export function createAudioController(runCommand: PactlRunner = runPactl): {
  lockAudio: () => Promise<void>;
  unlockAudio: () => Promise<void>;
} {
  let audioMutedBeforeLock: boolean | null = null;

  return {
    async lockAudio(): Promise<void> {
      try {
        const stdout = await runCommand(['get-sink-mute', '@DEFAULT_SINK@']);
        audioMutedBeforeLock = stdout.toLowerCase().includes('yes');
      } catch {
        audioMutedBeforeLock = null;
      }

      try {
        await runCommand(['set-sink-mute', '@DEFAULT_SINK@', '1']);
      } catch {
        // Ignore audio control failures on systems without pactl.
      }
    },

    async unlockAudio(): Promise<void> {
      const shouldUnmute = audioMutedBeforeLock === false || audioMutedBeforeLock === null;
      if (shouldUnmute) {
        try {
          await runCommand(['set-sink-mute', '@DEFAULT_SINK@', '0']);
        } catch {
          // Ignore audio control failures on systems without pactl.
        }
      }
      audioMutedBeforeLock = null;
    },
  };
}

export const { lockAudio, unlockAudio } = createAudioController();
