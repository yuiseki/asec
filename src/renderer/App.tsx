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
const SUCCESS_VISIBLE_MS = 2400;

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
  const [password, setPassword] = useState('');
  const remoteUnlockTimerRef = useRef<number | null>(null);
  const hideFinalizeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    initRingTicks();
  }, []);

  useEffect(() => {
    const clearTimers = () => {
      if (remoteUnlockTimerRef.current !== null) {
        window.clearTimeout(remoteUnlockTimerRef.current);
        remoteUnlockTimerRef.current = null;
      }
      if (hideFinalizeTimerRef.current !== null) {
        window.clearTimeout(hideFinalizeTimerRef.current);
        hideFinalizeTimerRef.current = null;
      }
    };

    const handleCommand = (command: SecurityRendererCommand) => {
      if (command.kind === 'lock/show') {
        clearTimers();
        setPassword('');
        setState((current) => showLockScreen(current, command.text));
        return;
      }
      if (command.kind === 'lock/hide') {
        setState((current) => {
          const next = beginRemoteUnlockSequence(current);
          if (next.phase === 'active') {
            hideFinalizeTimerRef.current = window.setTimeout(() => {
              void window.securitySurfaceApi.completeLockScreenHide().finally(() => {
                setState(completeHide());
              });
            }, SUCCESS_VISIBLE_MS);
            return next;
          }
          remoteUnlockTimerRef.current = window.setTimeout(() => {
            setState((authenticatingState) => {
              const successState = enterSuccessState(authenticatingState);
              hideFinalizeTimerRef.current = window.setTimeout(() => {
                void window.securitySurfaceApi.completeLockScreenHide().finally(() => {
                  setState(completeHide());
                });
              }, SUCCESS_VISIBLE_MS);
              return successState;
            });
          }, REMOTE_UNLOCK_PROGRESS_MS);
          return next;
        });
        return;
      }
      setState((current) =>
        enterErrorState(current, command.message));
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
      return;
    }

    setState((current) => enterCheckingState(current));
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
    }
  };

  const shellClassName = state.visible ? 'lock-screen-shell' : 'lock-screen-shell hidden';
  const statusClassName = state.statusMessage
    ? 'lock-screen-status'
    : 'lock-screen-status hidden';
  const welcomeClassName = state.phase === 'active'
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
                    strokeDasharray: '691.2',
                    strokeDashoffset: String((1 - state.ringProgress) * 691.2),
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
                value={password}
                disabled={state.submitting}
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
