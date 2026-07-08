(function () {
// Feature-map - Recording detail: last-analysis run metadata card (per-stage
// timing, effective settings, CPU/GPU device). Extracted out of videos.js
// (which grew into a catch-all) - the list/filter/detail-render/re-analysis
// core stays there.
//   API: routes/videos.py (analyze_run field) · Tests: tests/test_ui_video.py
// ── analysis run metadata card ────────────────────────────────────────────────
// Renders the stored record of the last analyze run (per-stage timing, effective
// settings, and CPU/GPU device) so the creator can answer "how long did this
// take, what settings, and did it use my GPU?".
// Display finished-run stage names with the same labels as the live progress
// bubbles (INGEST_STEPS), so the "Last analysis" card reads consistently with
// what the user watched during analysis. Covers names stored by older runs.
const _STAGE_LABEL = {
  'Extract audio':   'Extract',
  'Generate clips':  'Generate Clips',
  'Import captions': 'Transcribe',
};
function _stageLabel(name) { return _STAGE_LABEL[name] || name; }

function _runTimingLine(run) {
  const totalHms = _msToHms(run.elapsed_ms || 0);
  const stages = run.stages || [];
  const stageStr = stages.map(st => `${_stageLabel(st.name)} ${_msToHms((st.seconds || 0) * 1000)}`).join(' · ');
  return `Last run: ${totalHms} total${stageStr ? ` (${stageStr})` : ''}`;
}

function _renderRunMetaCard(video) {
  const run = video.analyze_run;
  if (!run) return '';
  const totalHms = _msToHms(run.elapsed_ms || 0);
  const dev = run.device || {};
  const deviceBadge = dev.has_gpu
    ? '<span class="run-meta-badge gpu" title="Used the GPU">GPU</span>'
    : '<span class="run-meta-badge cpu" title="Ran on CPU">CPU</span>';
  const when = run.finished_at ? ` &middot; ${escHtml(_fmtAgo(run.finished_at))}` : '';
  return `
    <details class="detail-card run-meta-card">
      <summary class="run-meta-summary">Last analysis &middot; <strong>${totalHms}</strong> ${deviceBadge}${when}</summary>
      <div class="run-meta-body">
        ${_runSettingsRows(run.settings || {}, dev)}
        ${_runStageBars(run.stages || [])}
      </div>
    </details>`;
}

function _runSettingsRows(s, dev) {
  const yesNo = (v) => v ? 'On' : 'Off';
  const rows = [
    ['Whisper model',  s.model],
    ['Track layout',   s.track_layout],
    ['Captions',       s.captions_source],
    ['Speaker labels', s.speaker_labels === undefined ? null : yesNo(s.speaker_labels)],
    ['Energy mode',    s.energy_mode],
    ['Scene mode',     s.scene_mode],
    ['LLM scoring',    s.scoring === undefined ? null : yesNo(s.scoring)],
    ['World contexts', (s.contexts && s.contexts.length) ? s.contexts.join(', ') : 'none'],
    ['Transcribe device', dev.transcribe],
    ['Diarization device', dev.diarization],
  ].filter(([, v]) => v !== null && v !== undefined && v !== '');
  return `<div class="run-meta-grid">${rows.map(([k, v]) =>
    `<div class="run-meta-key">${escHtml(k)}</div><div class="run-meta-val">${escHtml(String(v))}</div>`
  ).join('')}</div>`;
}

function _runStageBars(stages) {
  if (!stages.length) return '';
  const maxS = Math.max(...stages.map(st => st.seconds || 0), 0.001);
  const bars = stages.map(st => {
    const secs = st.seconds || 0;
    const pct = Math.max(2, Math.round(secs / maxS * 100));
    return `
      <div class="run-stage-row">
        <span class="run-stage-name">${escHtml(_stageLabel(st.name))}</span>
        <span class="run-stage-track"><span class="run-stage-fill" style="width:${pct}%"></span></span>
        <span class="run-stage-time">${_msToHms(secs * 1000)}</span>
      </div>`;
  }).join('');
  return `<div class="run-stage-bars"><div class="run-meta-subtitle">Stage timing</div>${bars}</div>`;
}

// Public API - symbols referenced cross-module, by an inline handler, or by a
// test. Internal helpers above stay private to this module's closure.
Object.assign(window, {
  _renderRunMetaCard, _runTimingLine,
});
})();
