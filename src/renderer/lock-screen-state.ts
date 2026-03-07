export type LockScreenPhase =
  | 'hidden'
  | 'locked'
  | 'authenticating'
  | 'active';

export type LockScreenState = {
  visible: boolean;
  phase: LockScreenPhase;
  title: string;
  subtitle: string;
  statusMessage: string;
  statusState: 'normal' | 'error';
  formVisible: boolean;
  submitting: boolean;
  ringState: 'locked' | 'checking' | 'success' | 'error';
  ringProgress: number;
};

export function createInitialLockScreenState(): LockScreenState {
  return {
    visible: false,
    phase: 'hidden',
    title: 'SYSTEM LOCKED',
    subtitle: 'Biometric authentication is required.',
    statusMessage: '',
    statusState: 'normal',
    formVisible: true,
    submitting: false,
    ringState: 'locked',
    ringProgress: 0.02,
  };
}

export function showLockScreen(
  _state: LockScreenState,
  title: string,
): LockScreenState {
  return {
    ...createInitialLockScreenState(),
    visible: true,
    phase: 'locked',
    title: title.trim() || 'SYSTEM LOCKED',
  };
}

export function enterCheckingState(
  state: LockScreenState,
): LockScreenState {
  return {
    ...state,
    visible: true,
    phase: 'authenticating',
    title: 'AUTHENTICATING...',
    subtitle: 'Biometric authentication is in progress.',
    statusMessage: '',
    statusState: 'normal',
    formVisible: false,
    submitting: true,
    ringState: 'checking',
    ringProgress: 0.86,
  };
}

export function markPasswordAccepted(
  state: LockScreenState,
): LockScreenState {
  return {
    ...state,
    phase: 'authenticating',
    statusMessage: 'Access code verified.',
    statusState: 'normal',
    submitting: false,
  };
}

export function enterSuccessState(
  state: LockScreenState,
): LockScreenState {
  return {
    ...state,
    visible: true,
    phase: 'active',
    title: 'SYSTEM ACTIVE',
    subtitle: 'Biometric authentication is complete.',
    statusMessage: '',
    statusState: 'normal',
    formVisible: false,
    submitting: false,
    ringState: 'success',
    ringProgress: 1,
  };
}

export function enterErrorState(
  state: LockScreenState,
  message: string,
): LockScreenState {
  return {
    ...state,
    phase: 'locked',
    title: 'SYSTEM LOCKED',
    subtitle: 'Biometric authentication is required.',
    statusMessage: message,
    statusState: 'error',
    formVisible: true,
    submitting: false,
    ringState: 'error',
    ringProgress: 0.02,
  };
}

export function beginRemoteUnlockSequence(
  state: LockScreenState,
): LockScreenState {
  if (!state.visible) {
    return state;
  }
  if (state.phase === 'authenticating') {
    return enterSuccessState(state);
  }
  if (state.phase === 'active') {
    return state;
  }
  return enterCheckingState(state);
}

export function completeHide(): LockScreenState {
  return createInitialLockScreenState();
}
