// exportPresetLabel / exportPresetIsVertical / exportPresetTargetSizeMb
// (static/library/exportpresets.js) - the graceful-degrade path for a preset
// name that no longer exists in AppState.exportPresets, e.g. because the user
// deleted a custom preset a clip's export history still references
// (row.preset_name in a clip_exports row has no FK back to the preset - see
// tests/integration/test_export_presets.py's delete-a-referenced-preset test).
import { AppState } from '../../../yuu_clip/web/static/core/state.js';
import {
  exportPresetLabel, exportPresetIsVertical, exportPresetTargetSizeMb,
} from '../../../yuu_clip/web/static/library/exportpresets.js';

beforeEach(() => {
  AppState.exportPresets = {
    builtins: [{name: 'youtube-1080p', label: 'YouTube 1080p', vertical: false, target_size_mb: null}],
    custom: [{name: 'my-preset', label: 'My Preset', vertical: true, target_size_mb: 10}],
  };
});

describe('exportPresetLabel', () => {
  it('resolves a known custom preset to its label', () => {
    expect(exportPresetLabel('my-preset')).toBe('My Preset');
  });

  it('falls back to the raw name for a deleted/unknown preset', () => {
    expect(exportPresetLabel('deleted-preset')).toBe('deleted-preset');
  });

  it('returns "Original quality" for no preset / "default"', () => {
    expect(exportPresetLabel('')).toBe('Original quality');
    expect(exportPresetLabel('default')).toBe('Original quality');
  });
});

describe('exportPresetIsVertical', () => {
  it('resolves a known preset', () => {
    expect(exportPresetIsVertical('my-preset')).toBe(true);
  });

  it('is false (not a crash) for a deleted/unknown preset', () => {
    expect(exportPresetIsVertical('deleted-preset')).toBe(false);
  });
});

describe('exportPresetTargetSizeMb', () => {
  it('resolves a known size-capped preset', () => {
    expect(exportPresetTargetSizeMb('my-preset')).toBe(10);
  });

  it('is null (not a crash) for a deleted/unknown preset', () => {
    expect(exportPresetTargetSizeMb('deleted-preset')).toBeNull();
  });
});
