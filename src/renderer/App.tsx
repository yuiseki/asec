import { useEffect, useRef, useState } from 'react';

import type { SecurityRendererCommand } from '@/shared/events';

import {
  beginRemoteUnlockSequence,
  completeHide,
  createInitialLockScreenState,
  enterCheckingState,
  enterErrorState,
  enterSuccessState,
  markPasswordAccepted,
  showLockScreen,
  type LockScreenState,
} from './lock-screen-state';

const REMOTE_UNLOCK_PROGRESS_MS = 900;
const CHECKING_RING_TARGET = 0.86;
const ERROR_RESET_MS = 950;
const ERROR_RING_RESET_MS = 420;
const SUCCESS_VISIBLE_MS = 2400;
const SUCCESS_RING_FILL_MS = 280;
const WELCOME_SHOW_DELAY_MS = 220;
const WELCOME_HIDE_DELAY_MS = SUCCESS_VISIBLE_MS - 400;
const FOCUS_PASSWORD_DELAY_MS = 50;
const RING_ANIMATION_STEP_MS = 16;
const RING_CIRCUMFERENCE = 691.2;
const INITIAL_LOCK_SCREEN_STATE = createInitialLockScreenState();

function easeOutCubic(progress: number): number {
  return 1 - ((1 - progress) ** 3);
}

function resolveLockScreenTitle(text: string): string {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines[0] || 'SYSTEM LOCKED';
}

function initRingTicks(): void {
  const group = document.getElementById('ls-ticks');
  if (!group || group.childNodes.length > 0) {
    return;
  }
  const cx = 140;
  const cy = 140;
  const totalTicks = 72;
  const innerRadius = 115;
  const minorRadius = 121;
  const majorRadius = 127;

  for (let index = 0; index < totalTicks; index += 1) {
    const angle = ((index / totalTicks) * 2 * Math.PI) - (Math.PI / 2);
    const isMajor = index % 9 === 0;
    const outerRadius = isMajor ? majorRadius : minorRadius;
    const x1 = cx + (innerRadius * Math.cos(angle));
    const y1 = cy + (innerRadius * Math.sin(angle));
    const x2 = cx + (outerRadius * Math.cos(angle));
    const y2 = cy + (outerRadius * Math.sin(angle));
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1.toFixed(2));
    line.setAttribute('y1', y1.toFixed(2));
    line.setAttribute('x2', x2.toFixed(2));
    line.setAttribute('y2', y2.toFixed(2));
    line.setAttribute('class', isMajor ? 'ls-tick-major' : 'ls-tick-minor');
    group.appendChild(line);
  }
}

export function App() {
  const [state, setState] = useState<LockScreenState>(
    createInitialLockScreenState,
  );
  const [displayRingProgress, setDisplayRingProgress] = useState(
    INITIAL_LOCK_SCREEN_STATE.ringProgress,
  );
  const [showWelcome, setShowWelcome] = useState(false);
  const [password, setPassword] = useState('');
  const stateRef = useRef<LockScreenState>(INITIAL_LOCK_SCREEN_STATE);
  const ringProgressRef = useRef(INITIAL_LOCK_SCREEN_STATE.ringProgress);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const remoteUnlockTimerRef = useRef<number | null>(null);
  const hideFinalizeTimerRef = useRef<number | null>(null);
  const errorResetTimerRef = useRef<number | null>(null);
  const welcomeShowTimerRef = useRef<number | null>(null);
  const welcomeHideTimerRef = useRef<number | null>(null);
  const focusPasswordTimerRef = useRef<number | null>(null);
  const ringAnimationTimerRef = useRef<number | null>(null);

  useEffect(() => {
    initRingTicks();
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const stopRingAnimation = () => {
    if (ringAnimationTimerRef.current !== null) {
      window.clearTimeout(ringAnimationTimerRef.current);
      ringAnimationTimerRef.current = null;
    }
  };

  const setRingProgressImmediate = (nextProgress: number) => {
    stopRingAnimation();
    ringProgressRef.current = nextProgress;
    setDisplayRingProgress(nextProgress);
  };

  const animateRingProgress = (
    targetProgress: number,
    durationMs: number,
  ) => {
    stopRingAnimation();
    const startProgress = ringProgressRef.current;
    if (durationMs <= 0) {
      setRingProgressImmediate(targetProgress);
      return;
    }
    const startedAt = Date.now();

    const step = () => {
      const elapsedMs = Date.now() - startedAt;
      const normalized = Math.min(1, elapsedMs / durationMs);
      const eased = easeOutCubic(normalized);
      const nextProgress = startProgress + (
        (targetProgress - startProgress) * eased
      );
      ringProgressRef.current = nextProgress;
      setDisplayRingProgress(nextProgress);
      if (normalized >= 1) {
        ringAnimationTimerRef.current = null;
        return;
      }
      ringAnimationTimerRef.current = window.setTimeout(
        step,
        RING_ANIMATION_STEP_MS,
      );
    };

    step();
  };

  const clearTimers = () => {
    if (remoteUnlockTimerRef.current !== null) {
      window.clearTimeout(remoteUnlockTimerRef.current);
      remoteUnlockTimerRef.current = null;
    }
    if (hideFinalizeTimerRef.current !== null) {
      window.clearTimeout(hideFinalizeTimerRef.current);
      hideFinalizeTimerRef.current = null;
    }
    if (errorResetTimerRef.current !== null) {
      window.clearTimeout(errorResetTimerRef.current);
      errorResetTimerRef.current = null;
    }
    if (welcomeShowTimerRef.current !== null) {
      window.clearTimeout(welcomeShowTimerRef.current);
      welcomeShowTimerRef.current = null;
    }
    if (welcomeHideTimerRef.current !== null) {
      window.clearTimeout(welcomeHideTimerRef.current);
      welcomeHideTimerRef.current = null;
    }
    if (focusPasswordTimerRef.current !== null) {
      window.clearTimeout(focusPasswordTimerRef.current);
      focusPasswordTimerRef.current = null;
    }
    stopRingAnimation();
    setShowWelcome(false);
  };

  const schedulePasswordFocus = () => {
    focusPasswordTimerRef.current = window.setTimeout(() => {
      passwordInputRef.current?.focus();
    }, FOCUS_PASSWORD_DELAY_MS);
  };

  const scheduleErrorFocus = () => {
    errorResetTimerRef.current = window.setTimeout(() => {
      passwordInputRef.current?.focus();
      passwordInputRef.current?.select();
    }, ERROR_RESET_MS);
  };

  const scheduleSuccessSequence = () => {
    animateRingProgress(1, SUCCESS_RING_FILL_MS);
    welcomeShowTimerRef.current = window.setTimeout(() => {
      setShowWelcome(true);
    }, WELCOME_SHOW_DELAY_MS);
    welcomeHideTimerRef.current = window.setTimeout(() => {
      setShowWelcome(false);
    }, WELCOME_HIDE_DELAY_MS);
    hideFinalizeTimerRef.current = window.setTimeout(() => {
      void window.securitySurfaceApi.completeLockScreenHide().finally(() => {
        setShowWelcome(false);
        setRingProgressImmediate(INITIAL_LOCK_SCREEN_STATE.ringProgress);
        setState(completeHide());
      });
    }, SUCCESS_VISIBLE_MS);
  };

  useEffect(() => {

    const handleCommand = (command: SecurityRendererCommand) => {
      if (command.kind === 'lock/show') {
        clearTimers();
        setPassword('');
        setRingProgressImmediate(INITIAL_LOCK_SCREEN_STATE.ringProgress);
        setState((current) =>
          showLockScreen(current, resolveLockScreenTitle(command.text)));
        schedulePasswordFocus();
        return;
      }
      if (command.kind === 'lock/hide') {
        clearTimers();
        const next = beginRemoteUnlockSequence(stateRef.current);
        if (next.phase === 'hidden') {
          return;
        }
        setState(next);
        if (next.phase === 'active') {
          scheduleSuccessSequence();
          return;
        }
        animateRingProgress(CHECKING_RING_TARGET, REMOTE_UNLOCK_PROGRESS_MS);
        remoteUnlockTimerRef.current = window.setTimeout(() => {
          const successState = enterSuccessState(stateRef.current);
          setState(successState);
          scheduleSuccessSequence();
        }, REMOTE_UNLOCK_PROGRESS_MS);
        return;
      }
      setState((current) =>
        enterErrorState(current, command.message));
      animateRingProgress(INITIAL_LOCK_SCREEN_STATE.ringProgress, ERROR_RING_RESET_MS);
      scheduleErrorFocus();
    };

    void window.securitySurfaceApi.rendererReady();
    const unsubscribe = window.securitySurfaceApi.onCommand(handleCommand);

    return () => {
      clearTimers();
      unsubscribe();
    };
  }, []);

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    if (!password.trim()) {
      setState((current) => enterErrorState(current, 'ACCESS CODE REQUIRED'));
      animateRingProgress(INITIAL_LOCK_SCREEN_STATE.ringProgress, ERROR_RING_RESET_MS);
      scheduleErrorFocus();
      return;
    }

    if (errorResetTimerRef.current !== null) {
      window.clearTimeout(errorResetTimerRef.current);
      errorResetTimerRef.current = null;
    }
    setState((current) => enterCheckingState(current));
    animateRingProgress(CHECKING_RING_TARGET, REMOTE_UNLOCK_PROGRESS_MS);
    const submittedPassword = password;
    setPassword('');
    try {
      await window.securitySurfaceApi.submitPassword(submittedPassword);
      setState((current) => markPasswordAccepted(current));
    } catch (error) {
      setState((current) =>
        enterErrorState(
          current,
          error instanceof Error ? error.message : String(error),
        ));
      animateRingProgress(INITIAL_LOCK_SCREEN_STATE.ringProgress, ERROR_RING_RESET_MS);
      scheduleErrorFocus();
    }
  };

  const shellClassName = state.visible ? 'lock-screen-shell' : 'lock-screen-shell hidden';
  const statusClassName = state.statusMessage
    ? 'lock-screen-status'
    : 'lock-screen-status hidden';
  const welcomeClassName = showWelcome
    ? 'ls-welcome'
    : 'ls-welcome hidden';

  return (
    <main className="overlay-root">
      <section
        id="lock-screen-shell"
        className={shellClassName}
        aria-live="assertive"
      >
        <div className="ls-bg-grid" aria-hidden="true" />
        <div className="ls-corner ls-corner-tl" aria-hidden="true" />
        <div className="ls-corner ls-corner-tr" aria-hidden="true" />
        <div className="ls-corner ls-corner-bl" aria-hidden="true" />
        <div className="ls-corner ls-corner-br" aria-hidden="true" />
        <div className="ls-bottom-bar" aria-hidden="true" />

        <div className="ls-content">
          <div className="ls-ring-wrapper" aria-hidden="true">
            <svg
              id="ls-ring-svg"
              className="ls-ring-svg"
              viewBox="0 0 280 280"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g id="ls-ticks" />
              <g transform="rotate(-90 140 140)">
                <circle className="ls-ring-track" cx="140" cy="140" r="110" />
                <circle
                  id="ls-ring-arc"
                  className="ls-ring-arc"
                  cx="140"
                  cy="140"
                  r="110"
                  data-state={state.ringState}
                  style={{
                    strokeDasharray: String(RING_CIRCUMFERENCE),
                    strokeDashoffset: String(
                      (1 - displayRingProgress) * RING_CIRCUMFERENCE,
                    ),
                  }}
                />
              </g>
              <circle className="ls-ring-inner-ring" cx="140" cy="140" r="95" />
              <circle className="ls-ring-inner-fill" cx="140" cy="140" r="87" />
              <circle className="ls-ring-center" cx="140" cy="140" r="5" />
            </svg>
          </div>

          <h1
            id="ls-title"
            className="ls-title"
            data-state={
              state.phase === 'active'
                ? 'success'
                : state.phase === 'authenticating'
                  ? 'authenticating'
                  : 'locked'
            }
          >
            {state.title}
          </h1>
          <p
            id="ls-subtitle"
            className="ls-subtitle"
            data-state={
              state.phase === 'active'
                ? 'success'
                : state.phase === 'authenticating'
                  ? 'authenticating'
                  : 'locked'
            }
          >
            {state.subtitle}
          </p>

          {state.formVisible ? (
            <form
              id="lock-screen-form"
              className="lock-screen-form"
              autoComplete="off"
              onSubmit={(event) => {
                void handleSubmit(event);
              }}
            >
              <input
                id="lock-screen-password"
                className="lock-screen-password"
                type="password"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="ENTER ACCESS CODE"
                aria-label="Access code"
                value={password}
                disabled={state.submitting}
                ref={passwordInputRef}
                onChange={(event) => {
                  setPassword(event.currentTarget.value);
                }}
              />
              <button
                id="lock-screen-submit"
                className="lock-screen-submit"
                type="submit"
                disabled={state.submitting}
              >
                UNLOCK
              </button>
            </form>
          ) : null}
          <p
            id="lock-screen-status"
            className={statusClassName}
            data-state={state.statusState}
          >
            {state.statusMessage}
          </p>
        </div>

        <div id="ls-welcome" className={welcomeClassName}>
          WELCOME TO SYSTEM
        </div>
      </section>
    </main>
  );
}
