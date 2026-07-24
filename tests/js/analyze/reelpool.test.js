// Pure reel-pool merge + estimate math extracted from static/analyze/reel.js
// (mergeReelPool / computeReelEstimate / fmtReelDuration). The DOM-writing
// _refetchReelPool / updateReelEstimate wrappers and the drag/reorder wiring
// stay in tests/ui/test_ui_reel.py.
import {
  mergeReelPool, computeReelEstimate, fmtReelDuration,
} from '../../../yuu_clip/web/static/analyze/reel.js';

const clip = (id, status, over = {}) => ({
  id, status, duration_ms: 1000, has_export: true, ...over,
});

describe('mergeReelPool', () => {
  it('defaults a newly-approved clip to included but leaves unreviewed/rejected excluded', () => {
    const merged = mergeReelPool([], [
      clip(1, 'approved'), clip(2, 'pending'), clip(3, 'rejected'),
    ]);
    expect(merged.map(c => [c.id, c.included])).toEqual([
      [1, true], [2, false], [3, false],
    ]);
  });

  it('keeps an existing clip\'s included choice even when the fresh copy is unapproved', () => {
    // User had turned an unreviewed clip on; a re-fetch must not silently turn it off.
    const existing = [{ ...clip(2, 'pending'), included: true }];
    const merged = mergeReelPool(existing, [clip(2, 'pending')]);
    expect(merged).toHaveLength(1);
    expect(merged[0].included).toBe(true);
  });

  it('preserves order: kept clips first (in their prior order), then newcomers', () => {
    const existing = [
      { ...clip(3, 'approved'), included: true },
      { ...clip(1, 'approved'), included: false },
    ];
    const fresh = [clip(1, 'approved'), clip(3, 'approved'), clip(5, 'approved')];
    const merged = mergeReelPool(existing, fresh);
    expect(merged.map(c => c.id)).toEqual([3, 1, 5]);
  });

  it('drops a clip that left the pool and re-includes it fresh when it returns', () => {
    const existing = [{ ...clip(9, 'approved'), included: false }];
    // 9 is gone from this fetch -> dropped.
    const gone = mergeReelPool(existing, [clip(1, 'approved')]);
    expect(gone.map(c => c.id)).toEqual([1]);
    // 9 comes back -> re-enters with the approved default, not its stale excluded state.
    const back = mergeReelPool(gone, [clip(1, 'approved'), clip(9, 'approved')]);
    expect(back.find(c => c.id === 9).included).toBe(true);
  });

  it('refreshes fields from the fresh copy while keeping the user\'s included choice', () => {
    const existing = [{ ...clip(1, 'approved', { has_export: false }), included: true }];
    const merged = mergeReelPool(existing, [clip(1, 'approved', { has_export: true })]);
    expect(merged[0].has_export).toBe(true);
    expect(merged[0].included).toBe(true);
  });
});

describe('computeReelEstimate', () => {
  it('uses a flat 5s encode ETA for the no-transition (stream-copy) path', () => {
    const est = computeReelEstimate(
      [clip(1, 'approved', { duration_ms: 30_000 })],
      { titleDur: 3, transition: 'none' },
    );
    expect(est.encodeEtaS).toBe(5);
    expect(est.totalFootageS).toBe(30);
  });

  it('applies the (footage + titles)/3 encode heuristic when a transition is set', () => {
    const est = computeReelEstimate(
      [clip(1, 'approved', { duration_ms: 30_000 }), clip(2, 'approved', { duration_ms: 30_000 })],
      { titleDur: 3, transition: 'fade' },
    );
    // (60 footage + 2*3 titles) / 3 = 22
    expect(est.encodeEtaS).toBe(22);
    expect(est.n).toBe(2);
  });

  it('counts included clips missing an export', () => {
    const est = computeReelEstimate(
      [clip(1, 'approved', { has_export: false }), clip(2, 'approved', { has_export: true })],
      { titleDur: 3, transition: 'fade' },
    );
    expect(est.unexported).toBe(1);
  });

  it('is empty-safe', () => {
    const est = computeReelEstimate([], { titleDur: 3, transition: 'fade' });
    expect(est).toEqual({ n: 0, totalFootageS: 0, encodeEtaS: 0, unexported: 0 });
  });
});

describe('fmtReelDuration', () => {
  it('shows whole seconds under a minute', () => {
    expect(fmtReelDuration(45.4)).toBe('45s');
  });

  it('shows m + padded-free seconds at or over a minute', () => {
    expect(fmtReelDuration(90)).toBe('1m 30s');
    expect(fmtReelDuration(60)).toBe('1m 0s');
  });
});
