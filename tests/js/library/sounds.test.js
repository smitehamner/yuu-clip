// SoundFx.play guards (static/library/sounds.js). Ported from the pure no-op cases
// in tests/ui/test_ui_sounds.py::TestSoundFxPlay - a disabled event and an unknown
// event key must both return before touching the shared <audio> player, so they
// need no browser. The actual-playback + stop-pill DOM cases stay in Playwright.
import { SoundFx } from '../../../yuu_clip/web/static/library/sounds.js';

// Actual playback appends a floating .sound-stop-pill to the body (via _showStopPill);
// its absence is the observable proof that play() returned before touching the shared
// <audio> player, so the guard clause can't be silently deleted without this failing.
const stopPill = () => document.querySelector('.sound-stop-pill');

beforeEach(() => localStorage.removeItem('yuuclip-sounds'));
afterEach(() => stopPill()?.remove());

describe('SoundFx.play', () => {
  it('is a no-op for an event the user has not enabled (default state)', () => {
    // Every event defaults to disabled, so play() must return before playback.
    SoundFx.play('analysis');
    expect(stopPill()).toBeNull();
  });

  it('is a no-op for an unknown event key', () => {
    SoundFx.play('not-a-real-event');
    expect(stopPill()).toBeNull();
  });
});
