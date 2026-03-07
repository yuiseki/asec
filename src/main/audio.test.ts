import { describe, expect, it, vi } from 'vitest';

import { createAudioController } from './audio';

describe('createAudioController', () => {
  it('mutes on lock and restores audio on unlock when the sink was previously unmuted', async () => {
    const pactlCalls: string[][] = [];
    const runPactl = vi.fn(async (args: string[]) => {
      pactlCalls.push(args);
      if (args[0] === 'get-sink-mute') {
        return 'Mute: no\n';
      }
      return '';
    });
    const audio = createAudioController(runPactl);

    await audio.lockAudio();
    await audio.unlockAudio();

    expect(pactlCalls).toContainEqual(['set-sink-mute', '@DEFAULT_SINK@', '1']);
    expect(pactlCalls).toContainEqual(['set-sink-mute', '@DEFAULT_SINK@', '0']);
  });

  it('keeps the sink muted on unlock when it was already muted before lock', async () => {
    const pactlCalls: string[][] = [];
    const runPactl = vi.fn(async (args: string[]) => {
      pactlCalls.push(args);
      if (args[0] === 'get-sink-mute') {
        return 'Mute: yes\n';
      }
      return '';
    });
    const audio = createAudioController(runPactl);

    await audio.lockAudio();
    await audio.unlockAudio();

    expect(pactlCalls).toContainEqual(['set-sink-mute', '@DEFAULT_SINK@', '1']);
    expect(pactlCalls).not.toContainEqual(['set-sink-mute', '@DEFAULT_SINK@', '0']);
  });

  it('unmutes on startup recovery when no prior lock state is known', async () => {
    const pactlCalls: string[][] = [];
    const runPactl = vi.fn(async (args: string[]) => {
      pactlCalls.push(args);
      return '';
    });
    const audio = createAudioController(runPactl);

    await audio.unlockAudio();

    expect(pactlCalls).toContainEqual(['set-sink-mute', '@DEFAULT_SINK@', '0']);
  });
});
