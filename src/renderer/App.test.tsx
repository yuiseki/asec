// @vitest-environment jsdom

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SecuritySurfaceApi } from '@/shared/security-surface-api';

import { App } from './App';

const REMOTE_UNLOCK_PROGRESS_MS = 900;
const SUCCESS_VISIBLE_MS = 2400;

function createApiMock(): SecuritySurfaceApi {
  return {
    onCommand: vi.fn(() => () => undefined),
    rendererReady: vi.fn(async () => ({ ok: true })),
    submitPassword: vi.fn(async () => ({ ok: true })),
    completeLockScreenHide: vi.fn(async () => ({ ok: true })),
    playDemo: vi.fn(async () => ({ ok: true })),
  };
}

describe('App', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('registers the renderer bridge on mount', () => {
    const api = createApiMock();
    window.securitySurfaceApi = api;

    render(<App />);

    expect(api.rendererReady).toHaveBeenCalledOnce();
    expect(api.onCommand).toHaveBeenCalledOnce();
  });

  it('shows lock text when a lock_screen_show command arrives', async () => {
    const api = createApiMock();
    let listener: ((command: { kind: 'lock/show'; text: string } | { kind: 'lock/hide' }) => void) | null = null;
    api.onCommand = vi.fn((nextListener) => {
      listener = nextListener;
      return () => undefined;
    });
    window.securitySurfaceApi = api;

    render(<App />);

    await act(async () => {
      listener?.({ kind: 'lock/show', text: 'SYSTEM LOCKED' });
    });

    expect(screen.getByText('SYSTEM LOCKED')).toBeInTheDocument();
  });

  it('validates blank password input in the renderer', async () => {
    const api = createApiMock();
    let listener: ((command: { kind: 'lock/show'; text: string } | { kind: 'lock/hide' }) => void) | null = null;
    api.onCommand = vi.fn((nextListener) => {
      listener = nextListener;
      return () => undefined;
    });
    window.securitySurfaceApi = api;

    render(<App />);

    await act(async () => {
      listener?.({ kind: 'lock/show', text: 'SYSTEM LOCKED' });
    });

    fireEvent.click(screen.getByRole('button', { name: 'UNLOCK' }));

    expect(screen.getByText('ACCESS CODE REQUIRED')).toBeInTheDocument();
    expect(api.submitPassword).not.toHaveBeenCalled();
  });

  it('calls completeLockScreenHide after lock_screen_hide animation', async () => {
    const api = createApiMock();
    let listener: ((command: { kind: 'lock/show'; text: string } | { kind: 'lock/hide' }) => void) | null = null;
    api.onCommand = vi.fn((nextListener) => {
      listener = nextListener;
      return () => undefined;
    });
    window.securitySurfaceApi = api;

    render(<App />);

    await act(async () => {
      listener?.({ kind: 'lock/show', text: 'SYSTEM LOCKED' });
    });

    await act(async () => {
      listener?.({ kind: 'lock/hide' });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(REMOTE_UNLOCK_PROGRESS_MS);
    });

    expect(screen.getByText('SYSTEM ACTIVE')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SUCCESS_VISIBLE_MS);
      await Promise.resolve();
    });

    expect(api.completeLockScreenHide).toHaveBeenCalledOnce();
  });
});
