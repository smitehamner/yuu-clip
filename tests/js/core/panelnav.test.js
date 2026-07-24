// The PanelNav takeover state machine (static/core/panelnav.js): the open/close/
// forceClose stack, the isDirty discard gate, and root show/hide. Driven on a bare
// DOM through the public API; the live breadcrumb geometry stays in
// tests/ui/test_ui_panelnav.py.
import { PanelNav } from '../../../yuu_clip/web/static/core/panelnav.js';

const seedDom = () => {
  document.body.innerHTML = `
    <div id="panelnav-root" style="display:none">
      <div id="panelnav-breadcrumb"></div>
      <div id="panelnav-content"></div>
    </div>`;
};

const openPanel = (over = {}) => PanelNav.open({
  id: 'p1', title: 'Panel One', render: () => {}, ...over,
});

const root = () => document.getElementById('panelnav-root');

beforeEach(() => {
  seedDom();
  window.showConfirm = vi.fn();
});

afterEach(() => {
  while (PanelNav.isOpen()) PanelNav.forceClose();  // drain the module-level stack
  delete window.showConfirm;
  document.body.innerHTML = '';
});

describe('open', () => {
  it('shows the root, mounts a container, and calls render with it', () => {
    const render = vi.fn();
    openPanel({ render });
    expect(root().style.display).toBe('flex');
    expect(PanelNav.isOpen()).toBe(true);
    expect(PanelNav.isOpen('p1')).toBe(true);
    expect(render).toHaveBeenCalledTimes(1);
    expect(render.mock.calls[0][0]).toBe(document.querySelector('#panelnav-content [data-panel-id="p1"]'));
  });

  it('renders the breadcrumb title and a Back button', () => {
    openPanel({ title: 'Edit & Export' });
    const crumb = document.getElementById('panelnav-breadcrumb');
    expect(crumb.querySelector('span').textContent).toBe('Edit & Export');
    expect(crumb.querySelector('button').textContent).toBe('← Back');
  });
});

describe('close (no dirty state)', () => {
  it('pops the panel and hides the root when the stack empties', () => {
    openPanel();
    PanelNav.close();
    expect(PanelNav.isOpen()).toBe(false);
    expect(root().style.display).toBe('none');
    expect(document.querySelector('[data-panel-id="p1"]')).toBe(null);
  });

  it('runs the panel onClose exactly once', () => {
    const onClose = vi.fn();
    openPanel({ onClose });
    PanelNav.close();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('nested panels', () => {
  it('unwinds one level at a time, keeping the root visible until the last close', () => {
    openPanel({ id: 'p1', title: 'One' });
    openPanel({ id: 'p2', title: 'Two' });
    expect(PanelNav.isOpen('p1')).toBe(true);
    expect(PanelNav.isOpen('p2')).toBe(true);

    PanelNav.close();  // closes p2 (top) only
    expect(PanelNav.isOpen('p2')).toBe(false);
    expect(PanelNav.isOpen('p1')).toBe(true);
    expect(root().style.display).toBe('flex');

    PanelNav.close();  // closes p1 -> empty
    expect(PanelNav.isOpen()).toBe(false);
    expect(root().style.display).toBe('none');
  });
});

describe('the dirty discard gate', () => {
  it('close prompts via showConfirm and does NOT pop until confirmed', () => {
    const onClose = vi.fn();
    openPanel({ isDirty: () => true, onClose });
    PanelNav.close();

    expect(window.showConfirm).toHaveBeenCalledTimes(1);
    expect(PanelNav.isOpen()).toBe(true);   // still open
    expect(onClose).not.toHaveBeenCalled();

    // showConfirm(title, body, label, onConfirm, danger) - fire its confirm callback.
    const onConfirm = window.showConfirm.mock.calls[0][3];
    onConfirm();
    expect(PanelNav.isOpen()).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('forceClose bypasses the gate and closes immediately', () => {
    openPanel({ isDirty: () => true });
    PanelNav.forceClose();
    expect(window.showConfirm).not.toHaveBeenCalled();
    expect(PanelNav.isOpen()).toBe(false);
  });

  it('a clean panel closes without prompting', () => {
    openPanel({ isDirty: () => false });
    PanelNav.close();
    expect(window.showConfirm).not.toHaveBeenCalled();
    expect(PanelNav.isOpen()).toBe(false);
  });
});

describe('isOpen on an empty stack', () => {
  it('is false with and without an id argument', () => {
    expect(PanelNav.isOpen()).toBe(false);
    expect(PanelNav.isOpen('anything')).toBe(false);
  });
});
