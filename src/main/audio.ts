import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

let audioMutedBeforeLock: boolean | null = null;

async function runPactl(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('pactl', args);
  return stdout;
}

export async function lockAudio(): Promise<void> {
  try {
    const stdout = await runPactl(['get-sink-mute', '@DEFAULT_SINK@']);
    audioMutedBeforeLock = stdout.toLowerCase().includes('yes');
  } catch {
    audioMutedBeforeLock = null;
  }

  try {
    await runPactl(['set-sink-mute', '@DEFAULT_SINK@', '1']);
  } catch {
    // Ignore audio control failures on systems without pactl.
  }
}

export async function unlockAudio(): Promise<void> {
  const shouldUnmute = audioMutedBeforeLock === false || audioMutedBeforeLock === null;
  if (shouldUnmute) {
    try {
      await runPactl(['set-sink-mute', '@DEFAULT_SINK@', '0']);
    } catch {
      // Ignore audio control failures on systems without pactl.
    }
  }
  audioMutedBeforeLock = null;
}
