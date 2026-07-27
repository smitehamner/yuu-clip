import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const showToast = vi.fn();
const appendLog = vi.fn();
const openLog = vi.fn();

vi.mock('../../../yuu_clip/web/static/core/utils.js', async (importActual) => ({
  ...(await importActual()),
  showToast,
  appendLog,
  openLog,
}));

const { initGlobalErrorReporter } = await import(
  '../../../yuu_clip/web/static/core/errorreporter.js'
);

// Wire the window listeners exactly once - re-initing per test would stack
// duplicate listeners on the shared happy-dom window and fire each handler N times.
initGlobalErrorReporter();

function fireError(message) {
  const event = new Event('error');
  event.message = message;
  event.error = new Error(message);
  window.dispatchEvent(event);
}

function fireRejection(reason) {
  const event = new Event('unhandledrejection');
  event.reason = reason;
  window.dispatchEvent(event);
}

describe('global error reporter', () => {
  let consoleError;

  beforeEach(() => {
    showToast.mockClear();
    appendLog.mockClear();
    openLog.mockClear();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
    vi.useRealTimers();
  });

  it('logs and toasts an uncaught error, and mirrors it to the console', () => {
    fireError('boom');

    expect(appendLog).toHaveBeenCalledWith('[Uncaught] Error: boom', true);
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast.mock.calls[0][0]).toBe(
      'Something went wrong. Open the log panel to copy the details for a bug report.',
    );
    expect(showToast.mock.calls[0][1]).toBe('error');
    expect(consoleError).toHaveBeenCalled();
  });

  it('the toast action opens the log panel', () => {
    fireError('kaboom');

    const opts = showToast.mock.calls[0][2];
    expect(opts.action.label).toBe('Show log');
    opts.action.onClick();
    expect(openLog).toHaveBeenCalledTimes(1);
  });

  it('reports an unhandled promise rejection with the reason message', () => {
    fireRejection(new Error('async failed'));

    expect(appendLog).toHaveBeenCalledWith('[Unhandled rejection] Error: async failed', true);
    expect(showToast).toHaveBeenCalledTimes(1);
  });

  it('stringifies a non-Error rejection reason', () => {
    fireRejection('plain string reason');

    expect(appendLog).toHaveBeenCalledWith('[Unhandled rejection] Error: plain string reason', true);
  });

  it('logs every occurrence of a looping error but toasts only once per window', () => {
    vi.useFakeTimers();

    fireError('loop');
    fireError('loop');
    fireError('loop');
    expect(appendLog).toHaveBeenCalledTimes(3);
    expect(showToast).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5001);
    fireError('loop');
    expect(appendLog).toHaveBeenCalledTimes(4);
    expect(showToast).toHaveBeenCalledTimes(2);
  });
});
