// Failure reporting for the two model-download flows in static/settings/modelcatalog.js.
//
// Both used to treat only the bare "__DONE__" string as terminal, so a subprocess that
// exited non-zero (the {type:'__DONE__', ok:false} form) fell through to the log as a
// literal "[object Object]" and the flow reported no error at all. And the reconnect
// poller treated "the server stopped saying downloading" as success, even though the
// server clears that registry key on failure and disconnect too.
//
// Mocks only the toast seam; the real render + stream-reading logic is what's under test.
vi.mock('../../../yuu_clip/web/static/core/utils.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, showToast: vi.fn() };
});

import { showToast } from '../../../yuu_clip/web/static/core/utils.js';
import {
  refreshModelCatalog, _renderCapabilityTiers,
} from '../../../yuu_clip/web/static/settings/modelcatalog.js';

const okJson = (obj) => ({ ok: true, json: async () => obj });

// A fetch Response whose body streams the given SSE payloads, then ends.
function sseResponse(payloads) {
  const encoder = new TextEncoder();
  const chunks = payloads.map((p) => encoder.encode(`data: ${JSON.stringify(p)}\n\n`));
  let i = 0;
  return {
    ok: true,
    body: {
      getReader: () => ({
        read: async () =>
          i < chunks.length ? { done: false, value: chunks[i++] } : { done: true },
      }),
    },
  };
}

const FAILURE_DONE = { type: '__DONE__', ok: false, error: 'the subprocess exited with code 1' };

const catalogEntry = (over = {}) => ({
  id: 'qwen', display_name: 'Qwen', backends: ['llamacpp'], kinds: ['text'],
  why: 'good', licence: 'Apache-2.0', size_gb: 4,
  gguf_url: 'https://example.invalid/m', gguf_filename: 'm.gguf',
  installed: false, active: false, ...over,
});

// showToast is a module-factory vi.fn(), so restoreAllMocks does NOT reset its call
// list - without an explicit clear, calls leak between tests and a `.at(-1)` assertion
// reads the previous test's toast.
beforeEach(() => { showToast.mockClear(); });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('Tier-B prefetch ("Download now")', () => {
  const tier = {
    id: 'speaker', name: 'Speaker labels', section: 'ai', active: 'off',
    purpose: 'p', upgrade: 'u', ready: false, prefetch_slug: 'speaker', install_slug: null,
  };

  // Success re-renders the whole tier list (to repaint the now-Ready row), which
  // destroys the log element - so the log text is only readable on the failure path.
  // The observable success signal is that re-render.
  async function renderTierAndClick(prefetchResponse) {
    const logText = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes('/api/capabilities/tiers')) {
        logText.push(document.getElementById('cap-prefetch-log-speaker')?.textContent ?? null);
        return okJson({ tiers: [tier] });
      }
      if (u.includes('/api/models/prefetch')) return prefetchResponse;
      return okJson({});
    });
    await _renderCapabilityTiers();
    const tierFetchesBefore = logText.length;
    document.querySelector('[data-prefetch="speaker"]').click();
    await vi.waitFor(() => {
      const live = document.getElementById('cap-prefetch-log-speaker').textContent;
      expect(live.includes('✗') || logText.length > tierFetchesBefore).toBe(true);
    });
    return {
      log: document.getElementById('cap-prefetch-log-speaker').textContent,
      logAtRerender: logText[tierFetchesBefore] ?? null,
      rerendered: logText.length > tierFetchesBefore,
    };
  }

  it('reports a failed prefetch as a failure, not silently', async () => {
    const { log, rerendered } = await renderTierAndClick(sseResponse(['fetching...', FAILURE_DONE]));
    expect(log).toContain('✗');
    expect(log).toContain('the subprocess exited with code 1');
    expect(log).not.toContain('[object Object]');
    expect(rerendered).toBe(false); // nothing became Ready, so no repaint
  });

  it('still reports a successful prefetch as ready', async () => {
    const { logAtRerender, rerendered } = await renderTierAndClick(
      sseResponse(['fetching...', '__DONE__']));
    expect(rerendered).toBe(true);
    expect(logAtRerender).toContain('✓ Ready.');
    expect(logAtRerender).not.toContain('✗');
  });
});

describe('reconnected .gguf download', () => {
  // Drive the reconnect path: the catalog render calls _reattachGgufProgress, which
  // sees a server-side download this page is not streaming and starts its 1s poller.
  async function reconnectThenSettle({ installedAfter }) {
    let downloading = true;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes('/api/llm/catalog')) {
        return okJson({
          models: [catalogEntry({ installed: downloading ? false : installedAfter })],
          models_dir: '/m', free_gb: 100, backend: 'llamacpp',
        });
      }
      if (u.includes('/api/llm/download-status')) {
        return okJson({ downloading, downloading_model_id: 'qwen' });
      }
      return okJson({});
    });
    await refreshModelCatalog();
    await vi.waitFor(() =>
      expect(document.querySelector('[data-gguf-progress]').style.display).toBe(''));
    downloading = false; // the server-side download ended - success or failure unknown
    await vi.waitFor(() => expect(showToast).toHaveBeenCalled(), { timeout: 4000 });
    return showToast.mock.calls.at(-1);
  }

  it('a download that ended WITHOUT installing the file is reported as a failure', async () => {
    const [message, level] = await reconnectThenSettle({ installedAfter: false });
    expect(level).toBe('error');
    expect(message).toMatch(/Download failed/);
  });

  it('a download that really landed the file is reported as ready', async () => {
    const [message, level] = await reconnectThenSettle({ installedAfter: true });
    expect(level).toBe('success');
    expect(message).toMatch(/ready/i);
  });
});
