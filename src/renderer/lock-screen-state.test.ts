import { describe, expect, it } from 'vitest';

import {
  beginRemoteUnlockSequence,
  createInitialLockScreenState,
  enterCheckingState,
  enterErrorState,
  markPasswordAccepted,
  showLockScreen,
} from './lock-screen-state';

describe('lock-screen-state', () => {
  it('shows the provided lock title', () => {
    const state = showLockScreen(
      createInitialLockScreenState(),
      'CUSTOM LOCK',
    );

    expect(state.visible).toBe(true);
    expect(state.title).toBe('CUSTOM LOCK');
    expect(state.phase).toBe('locked');
  });

  it('enters authenticating state before remote unlock completes', () => {
    const state = enterCheckingState(
      showLockScreen(createInitialLockScreenState(), 'SYSTEM LOCKED'),
    );

    expect(state.phase).toBe('authenticating');
    expect(state.formVisible).toBe(false);
    expect(state.ringState).toBe('checking');
  });

  it('keeps authenticating state after password acceptance until hide arrives', () => {
    const state = markPasswordAccepted(
      enterCheckingState(
        showLockScreen(createInitialLockScreenState(), 'SYSTEM LOCKED'),
      ),
    );

    expect(state.phase).toBe('authenticating');
    expect(state.statusMessage).toBe('Access code verified.');
  });

  it('transitions locked screen into remote unlock animation', () => {
    const state = beginRemoteUnlockSequence(
      showLockScreen(createInitialLockScreenState(), 'SYSTEM LOCKED'),
    );

    expect(state.phase).toBe('authenticating');
  });

  it('returns to locked state after an error', () => {
    const state = enterErrorState(
      enterCheckingState(
        showLockScreen(createInitialLockScreenState(), 'SYSTEM LOCKED'),
      ),
      'Access denied.',
    );

    expect(state.phase).toBe('locked');
    expect(state.statusState).toBe('error');
    expect(state.statusMessage).toBe('Access denied.');
    expect(state.formVisible).toBe(true);
  });
});
