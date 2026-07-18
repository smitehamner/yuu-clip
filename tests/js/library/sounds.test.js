// SoundFx.play guards (static/library/sounds.js). Ported from the pure no-op cases
// in tests/ui/test_ui_sounds.py::TestSoundFxPlay - a disabled event and an unknown
// event key must both return before touching the shared <audio> player, so they
// need no browser. The actual-playback + stop-pill DOM cases stay in Playwright.
import { SoundFx } from '../../../yuu_clip/web/static/library/sounds.js';

beforeEach(() => localStorage.removeItem('yuuclip-sounds'));

describe('SoundFx.play', () => {
  it('is a no-op for an event the user has not enabled (default state)', () => {
    // Every event defaults to disabled, so play() must return before playback.
    expect(() => SoundFx.play('analysis')).not.toThrow();
  });

  it('is a no-op for an unknown event key', () => {
    expect(() => SoundFx.play('not-a-real-event')).not.toThrow();
  });
});
