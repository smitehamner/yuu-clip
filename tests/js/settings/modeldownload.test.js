// static/settings/modeldownload.js - the boot-time background download banners
// (the wizard-queued LLM handoff + the default-on analysis-model prefetch).
// Mocks only the toast seam; everything else - the SSE parsing, banner rendering,
// and per-kind gating logic - runs for real against fetch mocks. On LLM success this
// module calls into modelcatalog.js's real _updateLlmCapabilities/_renderCapabilityTiers
// (not mocked: modeldownload.js -> modelcatalog.js -> settings.js -> analyze.js ->
// modeldownload.js is a real import cycle, and vi.mock + importActual on a module
// inside a live cycle does not reliably intercept the binding the cyclic importer
// sees - see voices.test.js for the same limitation spelled out in more detail).
// Their own fetches are routed to a harmless empty response below.
vi.mock('../../../yuu_clip/web/static/core/utils.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, showToast: vi.fn() };
});

import { showToast } from '../../../yuu_clip/web/static/core/utils.js';
import {
  initModelDownload, initModelPrefetch, getWhisperDownloadPct,
} from '../../../yuu_clip/web/static/settings/modeldownload.js';

const okJson = (obj) => ({ ok: true, json: async () => obj });

// A fetch Response whose body streams the given SSE payloads, then ends.
function sseResponse(payloads) {
  const encoder = new TextEncoder();
  const chunks = payloads.map((p) => encoder.encode(`data: ${JSON.stringify(p)}\n\n`));
  let i = 0;
  return {
    ok: true,
    body: { getReader: () => ({ read: async () => (i < chunks.length ? { done: false, value: chunks[i++] } : { done: true }) }) },
  };
}

// An SSE response whose chunks arrive under external control, so a test can
// inspect state between events instead of racing a stream that resolves
// entirely within one microtask flush.
function deferredSseResponse() {
  const encoder = new TextEncoder();
  const queue = [];
  let waiting = null;
  return {
    push(payload) {
      const chunk = { done: false, value: encoder.encode(`data: ${JSON.stringify(payload)}\n\n`) };
      if (waiting) { const resolve = waiting; waiting = null; resolve(chunk); } else queue.push(chunk);
    },
    end() {
      if (waiting) { const resolve = waiting; waiting = null; resolve({ done: true }); } else queue.push({ done: true });
    },
    response: {
      ok: true,
      body: { getReader: () => ({ read: () => (queue.length ? Promise.resolve(queue.shift()) : new Promise((r) => { waiting = r; })) }) },
    },
  };
}

function routedFetch(routes) {
  return vi.fn((url) => {
    const key = Object.keys(routes).find((k) => String(url).includes(k));
    if (!key) return Promise.reject(new Error(`unexpected fetch: ${url}`));
    const value = routes[key];
    return typeof value === 'function' ? value() : Promise.resolve(value);
  });
}

const SUCCESS_DONE = { v: 1, type: 'done', outcome: 'ok' };
const errDone = (message) => ({ v: 1, type: 'done', outcome: 'error', error: message });
const logEvt = (text) => ({ v: 1, type: 'log', text });

function banner() { return document.getElementById('model-download-banner'); }

beforeEach(() => {
  showToast.mockClear();
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('initModelDownload', () => {
  it('does nothing when no model download is pending', async () => {
    vi.stubGlobal('fetch', routedFetch({ '/api/llm/download-status': okJson({ pending_model_id: null }) }));

    await initModelDownload();

    expect(banner().style.display).toBe('none');
  });

  it('does not start a second stream when a download is already in progress elsewhere', async () => {
    const fetchMock = routedFetch({
      '/api/llm/download-status': okJson({ pending_model_id: 'qwen', downloading: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await initModelDownload();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(banner().querySelector('.mdl-row')).toBe(null);
  });

  it('clears a stale pending flag when a working model already exists', async () => {
    const fetchMock = routedFetch({
      '/api/llm/download-status': okJson({ pending_model_id: 'qwen', downloading: false }),
      '/api/llm/capabilities': okJson({ text: true }),
      '/api/llm/download-status/clear': okJson({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    await initModelDownload();

    expect(fetchMock).toHaveBeenCalledWith('/api/llm/download-status/clear', { method: 'POST' });
    expect(banner().querySelector('.mdl-row')).toBe(null);
  });

  it('starts the LLM download banner, reports success, and refreshes the capability displays', async () => {
    // /api/llm/capabilities must answer "not ready" for initModelDownload's own
    // pre-check (else it would decide a model already exists and skip the download
    // entirely) but "ready" once _updateLlmCapabilities re-checks after success.
    let capabilitiesChecked = 0;
    vi.stubGlobal('fetch', routedFetch({
      '/api/llm/capabilities': () => Promise.resolve(okJson(
        capabilitiesChecked++ === 0 ? { text: false } : { text: true, vision: false, detail: '' },
      )),
      '/api/llm/download-status': okJson({ pending_model_id: 'qwen', downloading: false }),
      'gguf/download': () => Promise.resolve(sseResponse([logEvt('50%'), SUCCESS_DONE])),
      '/api/llm/download-status/clear': okJson({}),
      '/api/capabilities/tiers': okJson({ tiers: [] }),
    }));

    await initModelDownload();

    await vi.waitFor(() => expect(showToast).toHaveBeenCalledWith('Local model ready - LLM scoring is now available.', 'success'));
    await vi.waitFor(() => {
      expect(document.getElementById('s-llm-capabilities').textContent).toContain('Ready');
    });
    expect(banner().querySelector('.mdl-row')).toBe(null);
  });

  it('shows a failure row when the download subprocess reports an error line', async () => {
    vi.stubGlobal('fetch', routedFetch({
      '/api/llm/download-status': okJson({ pending_model_id: 'qwen', downloading: false }),
      '/api/llm/capabilities': okJson({ text: false }),
      'gguf/download': () => Promise.resolve(sseResponse([logEvt('[error: disk full]'), SUCCESS_DONE])),
    }));

    await initModelDownload();

    await vi.waitFor(() => {
      const row = banner().querySelector('.mdl-row[data-mdl-kind="llm"]');
      expect(row.textContent).toContain('Model download failed');
    });
    expect(showToast).not.toHaveBeenCalled();
  });

  it('shows the offline copy when the stream reports a connection error', async () => {
    vi.stubGlobal('fetch', routedFetch({
      '/api/llm/download-status': okJson({ pending_model_id: 'qwen', downloading: false }),
      '/api/llm/capabilities': okJson({ text: false }),
      'gguf/download': () => Promise.reject(new Error('failed to fetch')),
    }));

    await initModelDownload();

    await vi.waitFor(() => {
      const row = banner().querySelector('.mdl-row[data-mdl-kind="llm"]');
      expect(row.textContent).toContain('No internet');
    });
  });

  it('dismisses a failed row on click', async () => {
    vi.stubGlobal('fetch', routedFetch({
      '/api/llm/download-status': okJson({ pending_model_id: 'qwen', downloading: false }),
      '/api/llm/capabilities': okJson({ text: false }),
      'gguf/download': () => Promise.resolve(sseResponse([logEvt('[error: x]'), SUCCESS_DONE])),
    }));
    await initModelDownload();
    await vi.waitFor(() => expect(banner().querySelector('[data-mdl-action="dismiss"]')).not.toBe(null));

    banner().querySelector('[data-mdl-action="dismiss"]').click();

    expect(banner().querySelector('.mdl-row')).toBe(null);
    expect(banner().style.display).toBe('none');
  });

  it('cancelling an in-progress download closes the stream and shows the cancel toast', async () => {
    const stream = deferredSseResponse(); // held open - the download never completes on its own
    vi.stubGlobal('fetch', routedFetch({
      '/api/llm/download-status': okJson({ pending_model_id: 'qwen', downloading: false }),
      '/api/llm/capabilities': okJson({ text: false }),
      'gguf/download': () => Promise.resolve(stream.response),
      '/api/llm/download-status/clear': okJson({}),
    }));
    await initModelDownload();
    stream.push(logEvt('10%'));
    await vi.waitFor(() => expect(banner().querySelector('.mdl-cancel')).not.toBe(null));

    banner().querySelector('[data-mdl-action="cancel"]').click();

    await vi.waitFor(() => expect(showToast).toHaveBeenCalledWith(
      'Local model setup skipped - you can set it up anytime in Settings.', 'info',
    ));
    expect(banner().querySelector('.mdl-row')).toBe(null);
  });
});

describe('initModelPrefetch', () => {
  it('does nothing when prefetch is disabled in config', async () => {
    const fetchMock = routedFetch({ '/api/config': okJson({ model_prefetch_disabled: true }) });
    vi.stubGlobal('fetch', fetchMock);

    await initModelPrefetch();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(banner().querySelector('.mdl-row')).toBe(null);
  });

  it('starts only the models that are missing, available, and not already downloading', async () => {
    vi.stubGlobal('fetch', routedFetch({
      '/api/config': okJson({ model_prefetch_disabled: false }),
      '/api/llm/download-status': okJson({
        whisper_cached: false, whisper_downloading: false,
        speaker_available: true, speaker_cached: true, speaker_downloading: false,
        audio_event_available: true, audio_event_cached: false, audio_event_downloading: false,
        face_detector_available: false, face_detector_cached: false, face_detector_downloading: false,
      }),
      '/api/whisper/prefetch': () => Promise.resolve(sseResponse([SUCCESS_DONE])),
      'slug=audio_event': () => Promise.resolve(sseResponse([SUCCESS_DONE])),
    }));

    await initModelPrefetch();

    await vi.waitFor(() => expect(banner().querySelector('.mdl-row')).toBe(null));
    // speaker: already cached (skipped); face_detector: unavailable (skipped) -
    // only whisper and audio_event should have reached "download complete" toasts.
    expect(showToast).toHaveBeenCalledWith('Speech model ready - your first analysis will be instant.', 'success');
    expect(showToast).toHaveBeenCalledWith('Audio-event model ready.', 'success');
    expect(showToast).not.toHaveBeenCalledWith('Speaker-labeling model ready.', 'success');
    expect(showToast).not.toHaveBeenCalledWith('Face-detector model ready.', 'success');
  });

  it('skips every kind when the status fetch fails', async () => {
    const fetchMock = routedFetch({
      '/api/config': okJson({ model_prefetch_disabled: false }),
      '/api/llm/download-status': () => Promise.reject(new Error('offline')),
    });
    vi.stubGlobal('fetch', fetchMock);

    await initModelPrefetch();

    expect(banner().querySelector('.mdl-row')).toBe(null);
  });
});

describe('getWhisperDownloadPct', () => {
  it('is null before any whisper download starts', () => {
    expect(getWhisperDownloadPct()).toBe(null);
  });

  it('reflects the last parsed percentage while a whisper download streams, then resets on completion', async () => {
    const stream = deferredSseResponse();
    vi.stubGlobal('fetch', routedFetch({
      '/api/config': okJson({ model_prefetch_disabled: false }),
      '/api/llm/download-status': okJson({
        whisper_cached: false, whisper_downloading: false,
        speaker_available: false, audio_event_available: false, face_detector_available: false,
      }),
      '/api/whisper/prefetch': () => Promise.resolve(stream.response),
    }));

    await initModelPrefetch();
    expect(getWhisperDownloadPct()).toBe(null);

    stream.push(logEvt('37% downloaded'));
    await vi.waitFor(() => expect(getWhisperDownloadPct()).toBe(37));

    stream.push(SUCCESS_DONE);
    stream.end();
    await vi.waitFor(() => expect(showToast).toHaveBeenCalledWith('Speech model ready - your first analysis will be instant.', 'success'));
    expect(getWhisperDownloadPct()).toBe(null);
  });
});
