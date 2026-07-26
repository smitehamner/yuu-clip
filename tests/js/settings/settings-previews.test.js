// static/settings/settings-previews.js - the export-filename and title-card live
// previews (pure DOM-in/DOM-out logic, no fetch). Both are read-modify-write off
// fixed index.html fields, so they're testable directly on the seeded DOM without
// mocking anything.
import {
  _updateExportNameTemplatePreview, _updateTitleCardPreview,
} from '../../../yuu_clip/web/static/settings/settings-previews.js';

describe('_updateExportNameTemplatePreview', () => {
  const setTemplate = (value) => { document.getElementById('s-export-name-template').value = value; };
  const preview = () => document.getElementById('export-name-template-preview').textContent;

  it('renders every known placeholder and sanitizes the result', () => {
    setTemplate('{video}_clip{clip_id}_{start}-{end}_{score}_{date}_{preset}');
    _updateExportNameTemplatePreview();
    expect(preview()).toMatch(/^Preview: MyRecording_clip42_15-30-16-00_0\.8_\d{4}-\d{2}-\d{2}_youtube-1080p\.mkv$/);
  });

  it('strips filesystem-unsafe characters and collapses whitespace', () => {
    setTemplate('{video}: clip <{clip_id}>?');
    _updateExportNameTemplatePreview();
    expect(preview()).toBe('Preview: MyRecording clip 42.mkv');
  });

  it('reports an unknown placeholder instead of rendering garbage', () => {
    setTemplate('{video}_{bogus}');
    _updateExportNameTemplatePreview();
    expect(preview()).toBe('Preview: (unknown placeholder in template)');
  });

  it('falls back to the default template text when the field is blank', () => {
    setTemplate('');
    _updateExportNameTemplatePreview();
    expect(preview()).toContain('MyRecording_clip42_15-30');
  });

  it('shows a placeholder note when sanitizing empties the whole result', () => {
    setTemplate('***');
    _updateExportNameTemplatePreview();
    expect(preview()).toBe('Preview: (empty - falls back to the default template).mkv');
  });
});

describe('_updateTitleCardPreview', () => {
  function fields({ bg = '#000000', fg = '#ffffff', scale = '1.0', template = '' } = {}) {
    document.getElementById('s-title-card-bg-color').value = bg;
    document.getElementById('s-title-card-font-color').value = fg;
    document.getElementById('s-title-card-scale').value = scale;
    document.getElementById('s-title-card-template').value = template;
  }

  it('renders one line per non-empty template line with the chosen colors', () => {
    fields({ template: '{description}\n{start} - {duration}' });
    _updateTitleCardPreview();
    const box = document.getElementById('s-title-card-preview');
    const lines = box.querySelectorAll('div');
    expect(lines).toHaveLength(2);
    expect(lines[0].textContent).toBe('Chaos erupts as the squad clutches a 1v4.');
    expect(lines[1].textContent).toBe('2:15 - 0:22');
    expect(box.style.background).toBe('#000000');
    expect(lines[0].style.color).toBe('#ffffff');
  });

  it('drops a blank rendered line rather than showing an empty row', () => {
    fields({ template: '{description}\n   \n{start}' });
    _updateTitleCardPreview();
    const lines = document.getElementById('s-title-card-preview').querySelectorAll('div');
    expect(lines).toHaveLength(2);
  });

  it('truncates an overlong rendered line with an ellipsis', () => {
    fields({ template: '{description}' + 'x'.repeat(100) });
    _updateTitleCardPreview();
    const line = document.getElementById('s-title-card-preview').querySelector('div');
    expect(line.textContent.length).toBe(90);
    expect(line.textContent.endsWith('…')).toBe(true);
  });

  it('falls back to a start/duration sample line when the template renders empty', () => {
    fields({ template: '' });
    _updateTitleCardPreview();
    const lines = document.getElementById('s-title-card-preview').querySelectorAll('div');
    expect(lines).toHaveLength(1);
    expect(lines[0].textContent).toBe('2:15  ·  0:22');
  });

  it('flags an unknown placeholder with a visible warning listing it once', () => {
    fields({ template: '{bogus} {bogus} {description}' });
    _updateTitleCardPreview();
    const warning = document.getElementById('s-title-card-template-warning');
    expect(warning.style.display).toBe('');
    expect(warning.textContent).toBe('⚠ Unknown placeholder: {bogus}');
  });

  it('hides the placeholder warning once every placeholder resolves', () => {
    fields({ template: '{bogus}' });
    _updateTitleCardPreview();
    fields({ template: '{description}' });
    _updateTitleCardPreview();
    expect(document.getElementById('s-title-card-template-warning').style.display).toBe('none');
  });

  it('shows a contrast warning for low-contrast color pairs', () => {
    fields({ bg: '#ffffff', fg: '#fefefe', template: '{description}' });
    _updateTitleCardPreview();
    expect(document.getElementById('s-title-card-contrast-warning').style.display).toBe('');
  });

  it('hides the contrast warning for a high-contrast pair', () => {
    fields({ bg: '#000000', fg: '#ffffff', template: '{description}' });
    _updateTitleCardPreview();
    expect(document.getElementById('s-title-card-contrast-warning').style.display).toBe('none');
  });
});
